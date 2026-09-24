import { hashAgentRunValue } from "./agent-run-service.mjs";
import { characterCommunicationTurnProjectionVersion } from "./character-communication-turn-projection-service.mjs";

export const characterCommunicationTurnParticipationIntentVersion =
  "cc7l-observer-participation-intent-v1";

const record = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const copy = (value) => JSON.parse(JSON.stringify(value ?? null));

function fail(message) {
  const error = new Error(message);
  error.code = "CC7L_PARTICIPATION_INTENT_INVALID";
  throw error;
}
function text(value, label, limit = 240) {
  if (typeof value !== "string" || !value.trim()
      || [...value.trim()].length > limit)
    fail(`${label} must be bounded nonblank text.`);
  return value.trim();
}
function exactKeys(value, allowed, label) {
  if (!record(value) || Object.keys(value).some((key) => !allowed.includes(key)))
    fail(`${label} contains non-contract fields.`);
}
function distinctRefs(value, label) {
  if (!Array.isArray(value) || value.length > 16)
    fail(`${label} must be a bounded list.`);
  const refs = value.map((ref) => text(ref, label));
  if (new Set(refs).size !== refs.length)
    fail(`${label} must be distinct.`);
  return refs;
}

export function buildCharacterCommunicationTurnParticipationIntentContract() {
  return {
    version: characterCommunicationTurnParticipationIntentVersion,
    source: "cc7a_same_observer_projected_turn_only",
    observer_authored_choice_required: true,
    subjective_wait_silence_backchannel_floor_request_supported: true,
    backchannel_requires_floor: false,
    request_floor_is_actual_floor_claim: false,
    prepared_response_does_not_auto_request_floor: true,
    acoustic_segment_end_does_not_auto_award_floor: true,
    overlap_is_not_interruption: true,
    co_completion_or_interruption_execution_supported: false,
    current_release_only_no_future_fragments: true,
    speaker_hidden_intent_available: false,
    source_action_or_sound_identity_available: false,
    actual_world_signal_emitted: false,
    actual_floor_arbitration_performed: false,
    interruption_judged: false,
    grounding_claimed: false,
    belief_updated: false,
    actual_mid_turn_world_action_replanning: false,
    fixed_gap_threshold_used: false,
  };
}

/**
 * A strictly provisional observer-owned intent based on one already-admitted
 * CC-7A turn projection. It is not physical talk, floor allocation, or an
 * interruption finding. CC-7L deliberately does not produce backchannel text
 * or overlap/co-completion actions; those require later World arbitration.
 */
export function projectCharacterCommunicationTurnParticipationIntent({
  observer,
  turn_projection,
  participation_decision,
  prior_state = null,
} = {}) {
  const listener = text(observer, "observer");
  exactKeys(turn_projection, [
    "schema_version", "projection_id", "observer", "perceived_speaker",
    "source_signal_ref", "source_increment_ref", "heard_surface_fragment",
    "signal_phase", "perceived_cue_refs", "turn_end_projection",
    "response_preparation", "lineage", "boundaries",
  ], "turn_projection");
  if (turn_projection.schema_version !== characterCommunicationTurnProjectionVersion
      || turn_projection.observer !== listener
      || text(turn_projection.perceived_speaker, "perceived_speaker") === listener)
    fail("CC-7L requires a same-observer CC-7A turn projection.");
  const signalRef = text(turn_projection.source_signal_ref, "source_signal_ref");
  const incrementRef = text(turn_projection.source_increment_ref, "source_increment_ref");
  const projectionId = text(turn_projection.projection_id, "projection_id");
  const perceivedRefs = distinctRefs(turn_projection.perceived_cue_refs, "perceived_cue_refs");
  if (!record(turn_projection.turn_end_projection)
      || turn_projection.turn_end_projection.subjective_only !== true
      || turn_projection.turn_end_projection.world_turn_end_claimed !== false
      || !record(turn_projection.response_preparation)
      || turn_projection.response_preparation.committed_action !== false
      || turn_projection.response_preparation.world_signal_emitted !== false
      || !record(turn_projection.lineage)
      || !record(turn_projection.boundaries)
      || turn_projection.boundaries.floor_claimed !== false
      || turn_projection.boundaries.floor_arbitrated !== false
      || turn_projection.boundaries.backchannel_emitted !== false
      || turn_projection.boundaries.overlap_classified_as_interruption !== false
      || turn_projection.boundaries.grounding_claimed !== false
      || turn_projection.boundaries.listener_belief_updated !== false)
    fail("CC-7L requires a noncommittal, subjective CC-7A projection.");

  exactKeys(participation_decision,
    ["mode", "basis_refs", "response_plan_ref"], "participation_decision");
  const mode = text(participation_decision.mode, "mode", 40);
  if (!["wait", "remain_silent", "backchannel", "request_floor", "withdraw"].includes(mode))
    fail("Unsupported observer participation mode.");
  const basisRefs = distinctRefs(participation_decision.basis_refs, "basis_refs");
  const availableRefs = new Set([incrementRef, ...perceivedRefs]);
  if (basisRefs.some((ref) => !availableRefs.has(ref)))
    fail("Participation basis must be perceived in the current observer increment.");
  if (["request_floor", "backchannel"].includes(mode) && basisRefs.length === 0)
    fail("An active participation intention requires perceived evidence.");
  const requestedPlan = participation_decision.response_plan_ref == null
    ? null : text(participation_decision.response_plan_ref, "response_plan_ref");
  if (mode === "request_floor") {
    if (turn_projection.response_preparation.state !== "ready"
        || !requestedPlan
        || requestedPlan !== turn_projection.response_preparation.response_plan_ref)
      fail("Requesting floor requires this observer's ready response plan.");
  } else if (requestedPlan !== null) {
    fail("Only a floor request may carry a response plan reference.");
  }

  if (prior_state !== null) {
    exactKeys(prior_state, [
      "schema_version", "intention_id", "observer", "perceived_speaker",
      "source_signal_ref", "source_increment_ref", "source_projection_id",
      "mode", "basis_refs", "response_plan_ref", "prior_intention_id",
      "revises_prior_intention", "subjective_only", "requires_external_floor_arbitration",
      "actual_floor_claimed", "backchannel_signal_emitted",
      "interruption_judged", "world_action_replanned",
    ], "prior_state");
    if (prior_state.schema_version !== characterCommunicationTurnParticipationIntentVersion
        || prior_state.observer !== listener
        || prior_state.perceived_speaker !== turn_projection.perceived_speaker
        || prior_state.source_signal_ref !== signalRef
        || prior_state.source_projection_id !== turn_projection.lineage.prior_projection_id
        || prior_state.subjective_only !== true
        || prior_state.actual_floor_claimed !== false
        || prior_state.backchannel_signal_emitted !== false
        || prior_state.interruption_judged !== false
        || prior_state.world_action_replanned !== false)
      fail("Prior participation must match this observer's immediate projection lineage.");
    text(prior_state.intention_id, "prior_intention_id");
  }
  if (mode === "withdraw" && prior_state?.mode !== "request_floor")
    fail("Withdraw requires a prior same-signal floor request.");
  if (prior_state?.source_increment_ref === incrementRef)
    fail("Participation may not repeat the same increment.");

  const identity = {
    version: characterCommunicationTurnParticipationIntentVersion,
    observer: listener,
    speaker: turn_projection.perceived_speaker,
    signal_ref: signalRef,
    increment_ref: incrementRef,
    projection_id: projectionId,
    mode,
    basis_refs: basisRefs,
    response_plan_ref: requestedPlan,
    prior_intention_id: prior_state?.intention_id ?? null,
  };
  return copy({
    schema_version: characterCommunicationTurnParticipationIntentVersion,
    intention_id: `cc7_participation_${hashAgentRunValue(identity).slice(0, 24)}`,
    observer: listener,
    perceived_speaker: turn_projection.perceived_speaker,
    source_signal_ref: signalRef,
    source_increment_ref: incrementRef,
    source_projection_id: projectionId,
    mode,
    basis_refs: basisRefs,
    response_plan_ref: requestedPlan,
    prior_intention_id: prior_state?.intention_id ?? null,
    revises_prior_intention: prior_state !== null,
    subjective_only: true,
    requires_external_floor_arbitration: mode === "request_floor",
    actual_floor_claimed: false,
    backchannel_signal_emitted: false,
    interruption_judged: false,
    world_action_replanned: false,
  });
}

export default projectCharacterCommunicationTurnParticipationIntent;
