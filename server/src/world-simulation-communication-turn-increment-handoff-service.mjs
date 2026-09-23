import { hashAgentRunValue } from "./agent-run-service.mjs";
import { projectCharacterCommunicationTurnProjection } from "./character-communication-turn-projection-service.mjs";
import { worldSimulationObserverSpeechIncrementVersion } from "./world-simulation-communication-observer-increment-service.mjs";

export const worldSimulationTurnIncrementHandoffVersion =
  "cc7d-native-observer-turn-increment-handoff-v1";

const record = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const array = (value) => Array.isArray(value) ? value : [];
const copy = (value) => JSON.parse(JSON.stringify(value ?? null));

function invalid(message) {
  const error = new Error(message);
  error.code = "CC7D_TURN_INCREMENT_HANDOFF_INVALID";
  throw error;
}
function bounded(value, label) {
  if (typeof value !== "string" || !value.trim()
      || [...value].length > 240) invalid(`${label} must be bounded nonblank text.`);
  return value;
}
function exactKeys(value, allowed, label) {
  if (!record(value) || Object.keys(value).some((key) => !allowed.includes(key)))
    invalid(`${label} contains non-contract fields.`);
}
function admittedCue(receipt) {
  const cue = receipt.observer_increment;
  if (receipt.schema_version !== worldSimulationObserverSpeechIncrementVersion
    || receipt.admission_status !== "heard_acoustic_cues_only"
    || !record(cue)
    || cue.schema_version !== "cc7-observer-speech-increment-v1"
    || cue.observer !== receipt.observer
    || cue.heard_surface_fragment !== null
    || cue.perceived_speaker !== null
    || cue.lexical_intelligibility_attested !== false
    || cue.speaker_identity_recognized !== false
    || cue.no_future_increment_exposed !== true
    || cue.release_time_ms !== receipt.release_time_ms
    || !Number.isFinite(receipt.release_time_ms)
    || receipt.release_time_ms < 0
    || !["ongoing", "locally_suspended", "acoustic_segment_ended"].includes(cue.signal_phase)
    || !Array.isArray(cue.perceived_cue_refs)
    || cue.perceived_cue_refs.length !== 1
    || new Set(cue.perceived_cue_refs).size !== 1)
    invalid("CC-7D requires one actually admitted nonlexical observer cue at its release time.");
  bounded(cue.observer, "observer");
  bounded(cue.signal_ref, "signal_ref");
  bounded(cue.increment_ref, "increment_ref");
  bounded(cue.perceived_cue_refs[0], "perceived cue");
  return cue;
}

export function buildWorldSimulationTurnIncrementHandoffContract() {
  return {
    version: worldSimulationTurnIncrementHandoffVersion,
    source: "cc7c_admitted_observer_cues_only",
    one_release_per_observer_resolver_invocation: true,
    observer_receives_future_releases: false,
    real_speaker_identity_forwarded: false,
    anonymous_speaker_ref_is_not_recognition: true,
    lexical_content_forwarded: false,
    no_resolver_means_no_subjective_projection: true,
    subjective_projection_decided_by_observer_resolver_only: true,
    projection_is_post_causal_speculative_evidence: true,
    actual_mid_turn_world_action_replanning: false,
    precommit_world_mutation: false,
    grounding_or_floor_claimed: false,
  };
}

/**
 * CC-7D is invoked after the existing causal resolve/consistency gate and
 * before the atomic turn commit. Each callback sees ONE released, audible,
 * observer-scoped cue, never the world's completed speech stream, engine
 * action/actor/sound IDs, or another observer's signal.
 *
 * The stable anonymous speaker handle is an interaction-local reference to
 * a perceived source, NOT knowledge of who spoke. This is an observer
 * projection handoff, not a real-time microtick that could change the
 * already-selected world action.
 */
export async function runWorldSimulationTurnIncrementHandoff({
  admissions = [],
  resolver = null,
} = {}) {
  if (!Array.isArray(admissions) || admissions.length > 4096)
    invalid("admissions must be a bounded list.");
  if (resolver != null && typeof resolver !== "function")
    invalid("resolver must be an observer-scoped function.");
  if (!resolver) return {
    schema_version: worldSimulationTurnIncrementHandoffVersion,
    resolver_used: false,
    projected_count: 0,
    projections: [],
    boundaries: buildWorldSimulationTurnIncrementHandoffContract(),
  };

  const ordered = admissions
    .filter((item) => item?.admission_status === "heard_acoustic_cues_only")
    .map((item) => ({ receipt: item, cue: admittedCue(item) }))
    .sort((a, b) =>
      a.receipt.release_time_ms - b.receipt.release_time_ms
      || a.cue.observer.localeCompare(b.cue.observer, "en")
      || a.cue.signal_ref.localeCompare(b.cue.signal_ref, "en")
      || a.cue.increment_ref.localeCompare(b.cue.increment_ref, "en"));
  const lastTimeBySignal = new Map();
  const seen = new Set();
  const priorBySignal = new Map();
  const projections = [];

  for (const { receipt, cue } of ordered) {
    const key = JSON.stringify([cue.observer, cue.signal_ref]);
    const incrementKey = JSON.stringify([key, cue.increment_ref]);
    if (seen.has(incrementKey)) invalid("Duplicate observer increment.");
    seen.add(incrementKey);
    if (lastTimeBySignal.has(key)
        && receipt.release_time_ms <= lastTimeBySignal.get(key))
      invalid("Observer increments must advance strictly in release time.");
    lastTimeBySignal.set(key, receipt.release_time_ms);

    const anonymousSpeaker = `anonymous_voice_${hashAgentRunValue({
      version: worldSimulationTurnIncrementHandoffVersion,
      observer: cue.observer,
      signal_ref: cue.signal_ref,
    }).slice(0, 24)}`;
    const perceivedIncrement = {
      schema_version: "cc7-observer-speech-increment-v1",
      observer: cue.observer,
      speaker: anonymousSpeaker,
      signal_ref: cue.signal_ref,
      increment_ref: cue.increment_ref,
      heard_surface_fragment: null,
      signal_phase: cue.signal_phase,
      perceived_cue_refs: copy(cue.perceived_cue_refs),
    };
    const prior = priorBySignal.get(key) ?? null;
    const view = {
      schema_version: worldSimulationTurnIncrementHandoffVersion,
      observer: cue.observer,
      anonymous_speaker_ref: anonymousSpeaker,
      speaker_identity_recognized: false,
      release_time_ms: receipt.release_time_ms,
      perceived_speech_increment: perceivedIncrement,
      prior_turn_projection: copy(prior),
      evidence_is_nonlexical_only: true,
      world_action_replanning_available: false,
    };
    const raw = await resolver(copy(view));
    if (raw == null) continue; // Observer may remain silent without projection.
    exactKeys(raw, ["listener_decision", "response_preparation_context"], "observer decision");
    if (!record(raw.listener_decision)) invalid("Observer must supply a bounded CC-7A decision.");
    const projection = projectCharacterCommunicationTurnProjection({
      observer: cue.observer,
      perceived_speech_increment: perceivedIncrement,
      listener_decision: raw.listener_decision,
      response_preparation_context: raw.response_preparation_context ?? null,
      prior_state: prior,
    });
    priorBySignal.set(key, projection);
    projections.push({
      schema_version: worldSimulationTurnIncrementHandoffVersion,
      observer: cue.observer,
      release_time_ms: receipt.release_time_ms,
      projection: copy(projection),
      subjective_only: true,
      actual_world_action_replanned: false,
    });
  }

  return copy({
    schema_version: worldSimulationTurnIncrementHandoffVersion,
    resolver_used: true,
    projected_count: projections.length,
    projections,
    boundaries: buildWorldSimulationTurnIncrementHandoffContract(),
  });
}
