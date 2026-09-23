import { hashAgentRunValue } from "./agent-run-service.mjs";

/**
 * CC-7A establishes a bounded, observer-subjective temporal projection for an
 * actually perceived speech increment. It does not arbitrate the floor, emit a
 * signal, decide interruption, or claim grounding/comprehension.
 */
export const characterCommunicationTurnProjectionVersion =
  "cc7a-subjective-turn-projection-response-preparation-v1";

const isRecord = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const copy = (value) => JSON.parse(JSON.stringify(value ?? null));
const text = (value, maxChars = 480) =>
  typeof value === "string"
  && value.trim()
  && [...value.trim()].length <= maxChars
    ? value.trim()
    : null;
const list = (value) => Array.isArray(value) ? value : [];

const SIGNAL_PHASES = new Set([
  "ongoing",
  "locally_suspended",
  "acoustic_segment_ended",
]);
const TURN_PROJECTIONS = new Set([
  "continuing",
  "possible_completion",
  "uncertain",
  "completed_for_current_joint_activity",
]);
const PREPARATION_DECISIONS = new Set([
  "none",
  "preparing",
  "ready",
  "abandon",
]);

function fail(message) {
  const error = new Error(message);
  error.code = "CHARACTER_COMMUNICATION_TURN_PROJECTION_INVALID";
  throw error;
}

function boundedDistinctTextList(value, label, {
  maxItems = 16,
  maxChars = 240,
} = {}) {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > maxItems)
    fail(`${label} must be a bounded list.`);
  const normalized = value.map((item) => text(item, maxChars));
  if (normalized.some((item) => !item)
    || new Set(normalized).size !== normalized.length)
    fail(`${label} must contain distinct nonblank values.`);
  return normalized;
}

function exactAllowedKeys(value, allowed, label) {
  if (!isRecord(value)) fail(`${label} must be structured.`);
  const illegal = Object.keys(value).filter((key) => !allowed.has(key));
  if (illegal.length)
    fail(`${label} contains non-contract fields: ${illegal.join(", ")}.`);
}

function normalizePerceivedIncrement(observer, input) {
  exactAllowedKeys(input, new Set([
    "schema_version",
    "observer",
    "speaker",
    "signal_ref",
    "increment_ref",
    "heard_surface_fragment",
    "signal_phase",
    "perceived_cue_refs",
  ]), "perceived_speech_increment");

  if (input.schema_version !== "cc7-observer-speech-increment-v1")
    fail("perceived_speech_increment must use the CC-7 observer increment schema.");

  const incrementObserver = text(input.observer, 240);
  const speaker = text(input.speaker, 240);
  const signalRef = text(input.signal_ref, 240);
  const incrementRef = text(input.increment_ref, 240);
  const heardSurfaceFragment = text(input.heard_surface_fragment, 1200);
  const signalPhase = text(input.signal_phase, 80);
  const perceivedCueRefs = boundedDistinctTextList(
    input.perceived_cue_refs,
    "perceived_speech_increment.perceived_cue_refs",
  );

  if (!incrementObserver || incrementObserver !== observer)
    fail("Perceived speech increment must belong to the same observer.");
  if (!speaker || speaker === observer)
    fail("Perceived speech increment requires a distinct perceived speaker.");
  if (!signalRef || !incrementRef || (!heardSurfaceFragment && perceivedCueRefs.length === 0))
    fail("Perceived speech increment requires signal, increment, and observer-perceived surface or cue evidence.");
  if (!SIGNAL_PHASES.has(signalPhase))
    fail("Perceived speech increment has an unsupported signal phase.");

  return {
    schema_version: "cc7-observer-speech-increment-v1",
    observer,
    speaker,
    signal_ref: signalRef,
    increment_ref: incrementRef,
    heard_surface_fragment: heardSurfaceFragment,
    signal_phase: signalPhase,
    perceived_cue_refs: perceivedCueRefs,
  };
}

function normalizePriorState(observer, speaker, signalRef, priorState) {
  if (priorState == null) return null;
  if (!isRecord(priorState)
    || priorState.schema_version !== characterCommunicationTurnProjectionVersion)
    fail("prior_state must be a CC-7A turn projection state.");
  if (priorState.observer !== observer
    || priorState.perceived_speaker !== speaker
    || priorState.source_signal_ref !== signalRef)
    fail("prior_state must belong to the same observer, speaker, and signal.");
  const preparation = isRecord(priorState.response_preparation)
    ? priorState.response_preparation : {};
  const state = text(preparation.state, 40);
  if (!["none", "preparing", "ready", "abandoned"].includes(state))
    fail("prior_state contains an invalid response preparation state.");
  return copy(priorState);
}

function normalizeResponsePreparationContext(observer, value) {
  if (value == null) return { available_response_plan_refs: [] };
  exactAllowedKeys(value, new Set([
    "observer",
    "available_response_plan_refs",
  ]), "response_preparation_context");
  if (text(value.observer, 240) !== observer)
    fail("response_preparation_context must belong to the same observer.");
  return {
    available_response_plan_refs: boundedDistinctTextList(
      value.available_response_plan_refs,
      "response_preparation_context.available_response_plan_refs",
    ),
  };
}

function normalizeDecision(decision, increment, priorState, responseContext) {
  exactAllowedKeys(decision, new Set([
    "turn_end_projection",
    "projection_basis_refs",
    "response_preparation",
    "response_plan_ref",
  ]), "listener_decision");

  const turnEndProjection = text(decision.turn_end_projection, 80);
  const preparationDecision = text(decision.response_preparation, 40);
  if (!TURN_PROJECTIONS.has(turnEndProjection))
    fail("listener_decision requires a bounded subjective turn-end projection.");
  if (!PREPARATION_DECISIONS.has(preparationDecision))
    fail("listener_decision requires a bounded response preparation decision.");

  const basisRefs = boundedDistinctTextList(
    decision.projection_basis_refs,
    "listener_decision.projection_basis_refs",
  );
  const perceivedRefs = new Set([
    increment.increment_ref,
    ...increment.perceived_cue_refs,
  ]);
  if (basisRefs.some((ref) => !perceivedRefs.has(ref)))
    fail("Turn projection basis must come from this observer's perceived increment evidence.");
  if (turnEndProjection !== "uncertain" && basisRefs.length === 0)
    fail("A non-uncertain turn projection requires observer-perceived basis evidence.");

  const responsePlanRef = decision.response_plan_ref == null
    ? null : text(decision.response_plan_ref, 240);
  if (decision.response_plan_ref != null && !responsePlanRef)
    fail("response_plan_ref must be a bounded nonblank same-character reference.");
  const availableResponsePlanRefs =
    new Set(responseContext.available_response_plan_refs);
  if (responsePlanRef
    && preparationDecision !== "abandon"
    && !availableResponsePlanRefs.has(responsePlanRef))
    fail("Response preparation may use only this observer's available response plans.");

  if (preparationDecision === "ready" && !responsePlanRef)
    fail("A ready response requires an explicit same-character response plan reference.");
  if (preparationDecision === "none" && responsePlanRef)
    fail("No response preparation may not carry a response plan reference.");

  const priorPreparation = priorState?.response_preparation ?? null;
  if (preparationDecision === "abandon"
    && !["preparing", "ready"].includes(priorPreparation?.state))
    fail("Abandoning a prepared response requires prior preparing or ready state.");
  if (preparationDecision === "abandon"
    && responsePlanRef
    && responsePlanRef !== priorPreparation?.response_plan_ref)
    fail("Abandon must reference the prior prepared response plan when supplied.");

  const effectiveResponsePlanRef = preparationDecision === "abandon"
    ? priorPreparation?.response_plan_ref ?? null
    : responsePlanRef;

  return {
    turn_end_projection: turnEndProjection,
    projection_basis_refs: basisRefs,
    response_preparation: preparationDecision,
    response_plan_ref: effectiveResponsePlanRef,
  };
}

export function buildCharacterCommunicationTurnProjectionContract() {
  return {
    version: characterCommunicationTurnProjectionVersion,
    owner: "character_communication_core",
    scope: "observer_subjective_incremental_turn_projection",
    actual_perceived_speech_increment_required: true,
    turn_end_projection_is_subjective: true,
    response_preparation_may_begin_before_signal_end: true,
    response_plan_must_be_observer_scoped: true,
    prepared_response_is_not_committed_action: true,
    projection_may_be_revised_by_later_increment: true,
    prepared_response_may_be_abandoned: true,
    silence_and_wait_remain_legal: true,
    overlap_is_not_interruption: true,
    backchannel_is_not_floor_claim: true,
    floor_arbitration_performed: false,
    interruption_judgment_performed: false,
    backchannel_signal_emitted: false,
    actual_world_signal_emitted: false,
    grounding_claimed: false,
    listener_belief_updated: false,
    speaker_hidden_intent_exposed: false,
    fixed_gap_threshold_used: false,
    technical_budget_is_psychology: false,
    long_term_memory_store_created: false,
  };
}

/**
 * Project one listener's temporary turn-end expectation and private response
 * preparation from one actually perceived speech increment. The caller must
 * provide observer-scoped acoustic/linguistic evidence; this service never
 * reads World truth, speaker intention, or another character's private state.
 *
 * This is deliberately pre-floor-management CC-7A. It cannot emit a
 * backchannel, claim the floor, classify overlap as interruption, or commit a
 * prepared response.
 */
export function projectCharacterCommunicationTurnProjection({
  observer,
  perceived_speech_increment,
  listener_decision,
  response_preparation_context = null,
  prior_state = null,
} = {}) {
  const listener = text(observer, 240);
  if (!listener) fail("observer is required.");
  if (!isRecord(perceived_speech_increment))
    fail("perceived_speech_increment is required.");
  if (!isRecord(listener_decision))
    fail("listener_decision is required.");

  const increment = normalizePerceivedIncrement(listener, perceived_speech_increment);
  const prior = normalizePriorState(
    listener,
    increment.speaker,
    increment.signal_ref,
    prior_state,
  );
  const responseContext = normalizeResponsePreparationContext(
    listener,
    response_preparation_context,
  );
  const decision = normalizeDecision(
    listener_decision,
    increment,
    prior,
    responseContext,
  );

  let preparationState = decision.response_preparation;
  if (preparationState === "abandon") preparationState = "abandoned";

  const identity = {
    version: characterCommunicationTurnProjectionVersion,
    observer: listener,
    speaker: increment.speaker,
    signal_ref: increment.signal_ref,
    increment_ref: increment.increment_ref,
    turn_end_projection: decision.turn_end_projection,
    projection_basis_refs: decision.projection_basis_refs,
    response_preparation: preparationState,
    response_plan_ref: decision.response_plan_ref,
    prior_projection_id: prior?.projection_id ?? null,
  };

  return copy({
    schema_version: characterCommunicationTurnProjectionVersion,
    projection_id: `cc7_turn_projection_${hashAgentRunValue(identity).slice(0, 24)}`,
    observer: listener,
    perceived_speaker: increment.speaker,
    source_signal_ref: increment.signal_ref,
    source_increment_ref: increment.increment_ref,
    heard_surface_fragment: increment.heard_surface_fragment,
    signal_phase: increment.signal_phase,
    perceived_cue_refs: increment.perceived_cue_refs,
    turn_end_projection: {
      status: decision.turn_end_projection,
      basis_refs: decision.projection_basis_refs,
      subjective_only: true,
      speaker_intent_inferred: false,
      world_turn_end_claimed: false,
    },
    response_preparation: {
      state: preparationState,
      response_plan_ref: decision.response_plan_ref,
      committed_action: false,
      world_signal_emitted: false,
    },
    lineage: {
      prior_projection_id: prior?.projection_id ?? null,
      revises_prior_projection: Boolean(prior),
      same_observer_signal_only: true,
    },
    boundaries: {
      temporary_interaction_state_only: true,
      long_term_memory_store_created: false,
      fixed_gap_threshold_used: false,
      technical_budget_used_as_psychology: false,
      floor_claimed: false,
      floor_arbitrated: false,
      backchannel_emitted: false,
      overlap_classified_as_interruption: false,
      grounding_claimed: false,
      listener_belief_updated: false,
      speaker_hidden_intent_exposed: false,
      world_truth_claimed: false,
    },
  });
}

export default projectCharacterCommunicationTurnProjection;
