import { hashAgentRunValue } from "./agent-run-service.mjs";
import { queryWorldSimulationObserverAudibility } from "./world-simulation-audibility-query-service.mjs";
import { worldSimulationCommunicationSpeechStreamVersion } from "./world-simulation-communication-speech-stream-service.mjs";

export const worldSimulationObserverSpeechIncrementVersion =
  "cc7c-observer-speech-increment-acoustic-admission-v1";

const record = (v) => v && typeof v === "object" && !Array.isArray(v);
const object = (v) => record(v) ? v : {};
const array = (v) => Array.isArray(v) ? v : [];
const clone = (v) => JSON.parse(JSON.stringify(v ?? null));

function reject(message) {
  const error = new Error(message);
  error.code = "CC7C_OBSERVER_INCREMENT_ADMISSION_INVALID";
  throw error;
}

function nonblank(value, label) {
  if (typeof value !== "string" || !value.trim() || [...value.trim()].length > 240)
    reject(`${label} requires bounded nonblank text.`);
  return value.trim();
}

export function buildWorldSimulationObserverSpeechIncrementContract() {
  return {
    version: worldSimulationObserverSpeechIncrementVersion,
    source: "committed_cc7b_stream_and_cc6b_registered_acoustic_signal",
    read_only_programmatic_audibility_required: true,
    physical_audibility_is_not_lexical_intelligibility: true,
    character_view_contains_engine_speaker_identity: false,
    character_view_contains_engine_action_or_sound_ids: false,
    character_view_contains_surface_text: false,
    character_view_contains_semantics: false,
    future_increment_exposure_allowed: false,
    observer_movement_and_dynamic_acoustics_supported: false,
    native_incremental_character_brain_invocation_here: false,
    subjective_turn_projection_automatically_decided: false,
    grounding_or_floor_claimed: false,
  };
}

/**
 * Acoustic cue admission for one observer and one fully resolved speech stream.
 * The engine privately has the full selected surface; the observer gets only
 * a cue when an increment has actually reached its release time AND the
 * explicitly configured Phase62Z acoustic test passes. That query does not
 * certify intelligibility, word recognition, or source recognition.
 *
 * This is a gated causal-timeline evidence view, NOT a live Character Brain
 * invocation. A future native scheduling slice must consume each release
 * at its own timestamp rather than hand a completed schedule to the brain.
 */
export function projectWorldSimulationObserverSpeechIncrements({
  world_state,
  scene_state,
  scene_id,
  observer,
  committed_outcome,
  acoustic_signal,
  causal_timeline,
  released_through_ms,
  static_acoustics_verified = false,
} = {}) {
  const listener = nonblank(observer, "observer");
  const sceneId = nonblank(scene_id, "scene_id");
  const outcome = object(committed_outcome);
  const speech = object(outcome.communication_event);
  const stream = object(outcome.communication_speech_stream);
  const signal = object(acoustic_signal);
  const speaker = nonblank(outcome.actor, "speaker");
  const actionId = nonblank(outcome.action_id, "source_action_id");
  const soundId = nonblank(signal.sound_id, "sound_id");
  const streamId = nonblank(stream.stream_id, "stream_id");
  if (listener === speaker) reject("Speaker may not receive an observer speech increment.");
  if (outcome.result !== "communication_emitted"
    || speech.channel !== "speech"
    || speech.surface_realization_complete !== true
    || speech.actor !== speaker
    || stream.schema_version !== worldSimulationCommunicationSpeechStreamVersion
    || stream.source_action_id !== actionId
    || signal.communication_action_id !== actionId
    || signal.source_entity_id !== speaker
    || signal.scene_id !== sceneId
    || signal.active !== true
    || signal.surface_text_exposed !== false
    || signal.semantic_content_exposed !== false)
    reject("Observer acoustic admission requires linked committed realized stream and registered sound.");
  if (static_acoustics_verified !== true)
    reject("Observer acoustic admission requires an explicit static-acoustics scope.");
  if (!Number.isFinite(released_through_ms) || released_through_ms < 0)
    reject("released_through_ms must be a finite non-negative release horizon.");

  const increments = array(stream.increments);
  const timeline = array(causal_timeline?.entries);
  if (increments.length < 1 || increments.length > 1200)
    reject("CC-7C requires a bounded nonempty stream.");
  const releaseEntries = [];
  for (const [index, increment] of increments.entries()) {
    if (increment.stream_id !== streamId || increment.sequence !== index + 1
      || !Number.isFinite(increment.end_offset_ms)
      || (index > 0 && increment.end_offset_ms <= increments[index - 1].end_offset_ms))
      reject("Stream increment lineage or release order is invalid.");
    const matching = timeline.filter((entry) =>
      entry.kind === "communication_speech_increment"
      && entry.stream_id === streamId
      && entry.action_id === actionId
      && entry.actor === speaker
      && entry.increment_ref === increment.increment_ref
      && entry.increment_sequence === increment.sequence
      && entry.time_ms === (increment.release_time_ms ?? increment.end_offset_ms)
      && entry.surface_fragment === increment.surface_fragment
      && entry.signal_phase === increment.signal_phase);
    if (matching.length !== 1)
      reject("Each release must match exactly one authoritative causal timeline entry.");
    if ((increment.release_time_ms ?? increment.end_offset_ms) <= released_through_ms)
      releaseEntries.push(increment);
  }

  // Pass only this explicitly registered source to the programmatic query:
  // prior-turn sounds may not be mistaken for the current speech stream.
  const query = queryWorldSimulationObserverAudibility({
    world_state: { ...object(world_state), sound_events: [clone(signal)] },
    scene_state: object(scene_state),
    scene_id: sceneId,
    observer: listener,
  });
  const audible = query.result.audibility_enforced === true
    && query.result.audible_sounds.some((item) => item.sound_id === soundId);
  const signalRef = `observer_signal_${hashAgentRunValue({
    version: worldSimulationObserverSpeechIncrementVersion,
    observer: listener,
    sound_id: soundId,
  }).slice(0, 24)}`;

  const observerIncrements = audible ? releaseEntries.map((increment) => ({
    schema_version: "cc7-observer-speech-increment-v1",
    observer: listener,
    signal_ref: signalRef,
    increment_ref: `observer_increment_${hashAgentRunValue({
      version: worldSimulationObserverSpeechIncrementVersion,
      signal_ref: signalRef,
      increment_ref: increment.increment_ref,
    }).slice(0, 24)}`,
    signal_phase: increment.signal_phase,
    perceived_cue_refs: [`audible_cue_${hashAgentRunValue({
      version: worldSimulationObserverSpeechIncrementVersion,
      signal_ref: signalRef,
      increment_ref: increment.increment_ref,
    }).slice(0, 24)}`],
    heard_surface_fragment: null,
    perceived_speaker: null,
    lexical_intelligibility_attested: false,
    speaker_identity_recognized: false,
    release_time_ms: increment.release_time_ms ?? increment.end_offset_ms,
    no_future_increment_exposed: true,
  })) : [];

  return clone({
    schema_version: worldSimulationObserverSpeechIncrementVersion,
    observer: listener,
    released_through_ms,
    admission_status: !query.result.audibility_enforced
      ? "acoustic_evidence_unavailable"
      : audible ? "heard_acoustic_cues_only" : "not_audible",
    observer_increments: observerIncrements,
    audit: {
      source_stream_id: streamId,
      source_action_id: actionId,
      source_sound_id: soundId,
      source_speaker: speaker,
      acoustic_query_hash: query.audit.result_hash,
      registered_sound_link_verified: true,
      static_acoustics_scope_verified: true,
      future_increments_withheld_count: increments.length - releaseEntries.length,
      source_content_forwarded_to_observer: false,
      listener_intelligibility_inferred: false,
      speaker_identity_inferred: false,
      floor_or_grounding_claimed: false,
      native_brain_increment_consumption_performed: false,
    },
  });
}
