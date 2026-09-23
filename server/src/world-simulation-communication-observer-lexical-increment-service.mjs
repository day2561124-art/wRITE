import { hashAgentRunValue } from "./agent-run-service.mjs";
import { worldSimulationObserverSpeechIncrementVersion } from "./world-simulation-communication-observer-increment-service.mjs";
import { worldSimulationCommunicationSpeechStreamVersion } from "./world-simulation-communication-speech-stream-service.mjs";

export const worldSimulationObserverLexicalIncrementVersion =
  "cc7j-observer-lexical-increment-admission-v1";

const record = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const array = (value) => Array.isArray(value) ? value : [];
const copy = (value) => JSON.parse(JSON.stringify(value ?? null));

function reject(message) {
  const error = new Error(message);
  error.code = "CC7J_OBSERVER_LEXICAL_INCREMENT_INVALID";
  throw error;
}

function text(value, label, maxChars = 1200) {
  if (typeof value !== "string" || !value.trim()
      || [...value.trim()].length > maxChars)
    reject(`${label} must be bounded nonblank text.`);
  return value.trim();
}

function surfaceFragment(value, label, maxChars = 1200) {
  if (typeof value !== "string" || value.length === 0
      || [...value].length > maxChars)
    reject(`${label} must be bounded emitted surface text.`);
  return value;
}

function exactKeys(value, allowed, label) {
  if (!record(value)
      || Object.keys(value).some((key) => !allowed.includes(key)))
    reject(`${label} contains fields outside its allowlist.`);
}

const recognitionStatuses = new Set([
  "recognized",
  "partial",
  "uncertain",
  "unintelligible",
]);

export function buildWorldSimulationObserverLexicalIncrementContract() {
  return {
    version: worldSimulationObserverLexicalIncrementVersion,
    source: "released_cc7b_surface_fragment_after_cc7c_audibility",
    resolver_receives_one_released_fragment_only: true,
    future_fragment_exposed: false,
    source_semantics_exposed: false,
    speaker_engine_identity_exposed: false,
    source_action_or_sound_identity_exposed: false,
    lexical_recognition_is_listener_subjective: true,
    partial_or_mistaken_recognition_allowed: true,
    acoustic_audibility_does_not_auto_create_lexical_recognition: true,
    no_resolver_means_no_lexical_recognition: true,
    persistent_audit_contains_surface_text: false,
    grounding_claimed: false,
    listener_belief_updated: false,
    world_truth_claimed: false,
    floor_or_interruption_decided: false,
    actual_mid_turn_world_action_replanning: false,
    fixed_timing_threshold_used: false,
  };
}

function empty(status, resolverUsed = false) {
  return {
    audit: {
      schema_version: worldSimulationObserverLexicalIncrementVersion,
      status,
      resolver_used: resolverUsed,
      candidate_count: 0,
      recognition_count: 0,
      recognitions: [],
      boundaries: buildWorldSimulationObserverLexicalIncrementContract(),
    },
    engine_private_lexical_increments: [],
  };
}

function admittedCue(receipt) {
  if (!record(receipt)
      || receipt.schema_version !== worldSimulationObserverSpeechIncrementVersion
      || receipt.admission_status !== "heard_acoustic_cues_only"
      || !record(receipt.observer_increment)
      || !record(receipt.audit))
    reject("CC-7J requires a verified CC-7C audible observer receipt.");
  const cue = receipt.observer_increment;
  exactKeys(cue, [
    "schema_version", "observer", "signal_ref", "increment_ref",
    "signal_phase", "perceived_cue_refs", "heard_surface_fragment",
    "perceived_speaker", "lexical_intelligibility_attested",
    "speaker_identity_recognized", "release_time_ms",
    "no_future_increment_exposed",
  ], "CC-7C observer increment");
  if (cue.schema_version !== "cc7-observer-speech-increment-v1"
      || cue.observer !== receipt.observer
      || typeof cue.signal_ref !== "string" || !cue.signal_ref.trim()
      || typeof cue.increment_ref !== "string" || !cue.increment_ref.trim()
      || !Number.isFinite(cue.release_time_ms) || cue.release_time_ms < 0
      || cue.release_time_ms !== receipt.release_time_ms
      || !["ongoing", "locally_suspended", "acoustic_segment_ended"].includes(cue.signal_phase)
      || !Array.isArray(cue.perceived_cue_refs)
      || cue.perceived_cue_refs.length !== 1
      || typeof cue.perceived_cue_refs[0] !== "string"
      || !cue.perceived_cue_refs[0].trim()
      || cue.heard_surface_fragment !== null
      || cue.perceived_speaker !== null
      || cue.lexical_intelligibility_attested !== false
      || cue.speaker_identity_recognized !== false
      || cue.no_future_increment_exposed !== true)
    reject("CC-7J accepts only nonlexical CC-7C observer receipts.");
  text(cue.observer, "observer", 240);
  text(cue.signal_ref, "signal_ref", 240);
  text(cue.increment_ref, "increment_ref", 240);
  text(cue.perceived_cue_refs[0], "perceived_cue_ref", 240);
  return cue;
}

function exactReleasedSource(receipt, cue, actionOutcomes) {
  const audit = receipt.audit;
  const actionId = text(audit.source_action_id, "source_action_id", 240);
  const streamId = text(audit.source_stream_id, "source_stream_id", 240);
  const soundId = text(audit.source_sound_id, "source_sound_id", 240);
  const speaker = text(audit.source_speaker, "source_speaker", 240);
  if (audit.registered_sound_link_verified !== true
      || audit.static_acoustics_scope_verified !== true)
    reject("CC-7J requires verified CC-7C sound and acoustics lineage.");
  const expectedSignalRef =
    `observer_signal_${hashAgentRunValue({
      version: worldSimulationObserverSpeechIncrementVersion,
      observer: cue.observer,
      sound_id: soundId,
    }).slice(0, 24)}`;
  if (cue.signal_ref !== expectedSignalRef)
    reject("CC-7J observer signal does not match its verified CC-7C sound lineage.");
  const matches = array(actionOutcomes).filter((outcome) =>
    record(outcome)
    && outcome.action_id === actionId
    && outcome.actor === speaker
    && outcome.result === "communication_emitted"
    && record(outcome.communication_event)
    && outcome.communication_event.channel === "speech"
    && outcome.communication_event.surface_realization_complete === true
    && record(outcome.communication_speech_stream)
    && outcome.communication_speech_stream.schema_version
      === worldSimulationCommunicationSpeechStreamVersion
    && outcome.communication_speech_stream.stream_id === streamId
    && outcome.communication_speech_stream.source_action_id === actionId);
  if (matches.length !== 1)
    reject("CC-7J requires one exact committed source speech stream.");
  const outcome = matches[0];
  const stream = outcome.communication_speech_stream;
  const increments = array(stream.increments);
  const released = increments.filter((increment) =>
    record(increment)
    && increment.stream_id === streamId
    && increment.end_offset_ms === cue.release_time_ms
    && increment.signal_phase === cue.signal_phase);
  if (released.length !== 1)
    reject("CC-7J receipt must bind to one exact released source increment.");
  const source = released[0];
  const expectedIncrementRef =
    `observer_increment_${hashAgentRunValue({
      version: worldSimulationObserverSpeechIncrementVersion,
      signal_ref: cue.signal_ref,
      increment_ref: source.increment_ref,
    }).slice(0, 24)}`;
  const expectedCueRef =
    `audible_cue_${hashAgentRunValue({
      version: worldSimulationObserverSpeechIncrementVersion,
      signal_ref: cue.signal_ref,
      increment_ref: source.increment_ref,
    }).slice(0, 24)}`;
  if (cue.increment_ref !== expectedIncrementRef
      || cue.perceived_cue_refs[0] !== expectedCueRef)
    reject("CC-7J observer receipt does not match its released source increment.");
  const fragment = surfaceFragment(
    source.surface_fragment,
    "released surface fragment",
  );
  const realization = record(outcome.communication_event.surface_realization)
    ? outcome.communication_event.surface_realization : {};
  return {
    fragment,
    language:
      typeof realization.language === "string" && realization.language.trim()
        ? realization.language.trim()
        : null,
  };
}

function normalizeRecognition(raw) {
  exactKeys(raw, ["recognition_status", "heard_surface_fragment"], "lexical recognition");
  if (!recognitionStatuses.has(raw.recognition_status))
    reject("Lexical recognition status is unsupported.");
  if (raw.recognition_status === "unintelligible") {
    if (raw.heard_surface_fragment !== null)
      reject("Unintelligible recognition cannot carry heard surface text.");
    return {
      recognition_status: raw.recognition_status,
      heard_surface_fragment: null,
      lexical_intelligibility_attested: false,
    };
  }
  return {
    recognition_status: raw.recognition_status,
    heard_surface_fragment:
      text(raw.heard_surface_fragment, "heard_surface_fragment"),
    lexical_intelligibility_attested: true,
  };
}

/**
 * Exposes exactly one already-released public speech fragment to the matching
 * observer's lexical-recognition resolver, but only after CC-7C proved that
 * this observer could physically hear that increment. The engine source
 * fragment is a symbolic stand-in for the acoustic pattern, not a guarantee
 * that the listener recognized it correctly.
 */
export async function runWorldSimulationObserverLexicalIncrementAdmission({
  admissions = [],
  action_outcomes = [],
  resolver = null,
} = {}) {
  if (!Array.isArray(admissions) || admissions.length > 4096)
    reject("Admissions must be a bounded list.");
  if (!Array.isArray(action_outcomes) || action_outcomes.length > 4096)
    reject("Action outcomes must be a bounded list.");
  if (resolver != null && typeof resolver !== "function")
    reject("Resolver must be a callable observer lexical adapter.");

  const candidates = admissions
    .filter((item) => item?.admission_status === "heard_acoustic_cues_only")
    .map((receipt) => {
      const cue = admittedCue(receipt);
      const source = exactReleasedSource(receipt, cue, action_outcomes);
      return { receipt, cue, source };
    })
    .sort((a, b) =>
      a.cue.release_time_ms - b.cue.release_time_ms
      || a.cue.observer.localeCompare(b.cue.observer, "en")
      || a.cue.signal_ref.localeCompare(b.cue.signal_ref, "en")
      || a.cue.increment_ref.localeCompare(b.cue.increment_ref, "en"));

  if (!resolver) {
    const result = empty("resolver_not_installed");
    result.audit.candidate_count = candidates.length;
    return result;
  }

  const seen = new Set();
  const recognitions = [];
  const auditRecognitions = [];

  for (const { cue, source } of candidates) {
    const key = JSON.stringify([
      cue.observer,
      cue.signal_ref,
      cue.increment_ref,
      cue.release_time_ms,
    ]);
    if (seen.has(key)) reject("Duplicate observer lexical increment candidate.");
    seen.add(key);

    const packet = {
      schema_version: worldSimulationObserverLexicalIncrementVersion,
      observer: cue.observer,
      release_time_ms: cue.release_time_ms,
      signal_ref: cue.signal_ref,
      increment_ref: cue.increment_ref,
      signal_phase: cue.signal_phase,
      emitted_surface_fragment: source.fragment,
      signal_language: source.language,
      perceived_cue_refs: copy(cue.perceived_cue_refs),
      boundaries: {
        source_identity_available: false,
        source_action_identity_available: false,
        source_semantics_available: false,
        future_fragment_available: false,
        world_truth_authority: false,
      },
    };
    const raw = await resolver(copy(packet));
    if (raw == null) continue;
    const decision = normalizeRecognition(raw);
    const recognition = {
      schema_version: worldSimulationObserverLexicalIncrementVersion,
      observer: cue.observer,
      signal_ref: cue.signal_ref,
      increment_ref: cue.increment_ref,
      release_time_ms: cue.release_time_ms,
      recognition_status: decision.recognition_status,
      heard_surface_fragment: decision.heard_surface_fragment,
      lexical_intelligibility_attested:
        decision.lexical_intelligibility_attested,
      subjective_only: true,
    };
    recognitions.push(recognition);
    auditRecognitions.push({
      observer_ref: `observer_${hashAgentRunValue({
        version: worldSimulationObserverLexicalIncrementVersion,
        observer: cue.observer,
      }).slice(0, 24)}`,
      release_time_ms: cue.release_time_ms,
      recognition_status: decision.recognition_status,
      heard_surface_present: decision.heard_surface_fragment !== null,
    });
  }

  return {
    audit: {
      schema_version: worldSimulationObserverLexicalIncrementVersion,
      status: "observer_subjective_lexical_recognition",
      resolver_used: true,
      candidate_count: candidates.length,
      recognition_count: recognitions.length,
      recognitions: auditRecognitions,
      boundaries: buildWorldSimulationObserverLexicalIncrementContract(),
    },
    engine_private_lexical_increments: recognitions,
  };
}

export default runWorldSimulationObserverLexicalIncrementAdmission;
