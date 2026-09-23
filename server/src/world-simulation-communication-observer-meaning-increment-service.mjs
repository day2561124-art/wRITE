import { hashAgentRunValue } from "./agent-run-service.mjs";
import { characterCommunicationListenerUnderstandingVersion } from "./character-communication-listener-understanding-service.mjs";
import { worldSimulationObserverLexicalIncrementVersion } from "./world-simulation-communication-observer-lexical-increment-service.mjs";

export const worldSimulationObserverMeaningIncrementVersion =
  "cc7k-observer-meaning-increment-admission-v1";

const record = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const copy = (value) => JSON.parse(JSON.stringify(value ?? null));

function reject(message) {
  const error = new Error(message);
  error.code = "CC7K_OBSERVER_MEANING_INCREMENT_INVALID";
  throw error;
}

function boundedText(value, label, maxChars = 1200) {
  if (typeof value !== "string" || !value.trim()
      || [...value.trim()].length > maxChars)
    reject(`${label} must be bounded nonblank text.`);
  return value.trim();
}

function optionalText(value, label, maxChars = 1200) {
  if (value == null) return null;
  return boundedText(value, label, maxChars);
}

function exactKeys(value, allowed, label) {
  if (!record(value) || Object.keys(value).some((key) => !allowed.includes(key)))
    reject(`${label} contains fields outside its allowlist.`);
}

const recognitionStatuses = new Set([
  "recognized", "partial", "uncertain", "unintelligible",
]);
const interpretationStatuses = new Set([
  "interpreted", "partial", "uncertain", "uninterpreted",
]);

function normalizeLexicalIncrement(item) {
  exactKeys(item, [
    "schema_version", "observer", "signal_ref", "increment_ref",
    "release_time_ms", "recognition_status", "heard_surface_fragment",
    "lexical_intelligibility_attested", "subjective_only",
  ], "CC-7J lexical increment");
  if (item.schema_version !== worldSimulationObserverLexicalIncrementVersion)
    reject("CC-7K accepts only canonical CC-7J lexical increments.");
  const observer = boundedText(item.observer, "observer", 240);
  const signalRef = boundedText(item.signal_ref, "signal_ref", 240);
  const incrementRef = boundedText(item.increment_ref, "increment_ref", 240);
  if (!Number.isFinite(item.release_time_ms) || item.release_time_ms < 0)
    reject("release_time_ms must be a nonnegative finite number.");
  if (!recognitionStatuses.has(item.recognition_status)
      || item.subjective_only !== true)
    reject("CC-7K requires subjective CC-7J lexical recognition.");
  const heard = item.heard_surface_fragment == null
    ? null : boundedText(item.heard_surface_fragment, "heard_surface_fragment");
  if ((heard === null) !== (item.lexical_intelligibility_attested === false))
    reject("CC-7J lexical intelligibility lineage is inconsistent.");
  if (heard !== null && item.lexical_intelligibility_attested !== true)
    reject("Recognized surface requires lexical intelligibility attestation.");
  return {
    schema_version: worldSimulationObserverLexicalIncrementVersion,
    observer,
    signal_ref: signalRef,
    increment_ref: incrementRef,
    release_time_ms: item.release_time_ms,
    recognition_status: item.recognition_status,
    heard_surface_fragment: heard,
    lexical_intelligibility_attested: item.lexical_intelligibility_attested,
    subjective_only: true,
  };
}

function normalizeDecision(raw) {
  exactKeys(raw, [
    "interpretation_status",
    "interpreted_content",
    "interpreted_interaction_function",
    "understanding_attested",
  ], "listener incremental meaning decision");
  if (!interpretationStatuses.has(raw.interpretation_status))
    reject("interpretation_status is unsupported.");
  const content = optionalText(raw.interpreted_content, "interpreted_content");
  const interactionFunction = optionalText(
    raw.interpreted_interaction_function,
    "interpreted_interaction_function",
    240,
  );
  const understanding = raw.understanding_attested === true;
  if (raw.understanding_attested != null
      && typeof raw.understanding_attested !== "boolean")
    reject("understanding_attested must be boolean when supplied.");
  if (raw.interpretation_status === "uninterpreted") {
    if (content !== null || interactionFunction !== null || understanding)
      reject("Uninterpreted increment cannot carry interpreted meaning.");
  } else if (content === null) {
    reject("A meaning interpretation requires listener-authored interpreted_content.");
  }
  if (understanding && raw.interpretation_status !== "interpreted")
    reject("Understanding may be attested only for an interpreted increment.");
  return {
    interpretation_status: raw.interpretation_status,
    interpreted_content: content,
    interpreted_interaction_function: interactionFunction,
    understanding_attested: understanding,
  };
}

export function buildWorldSimulationObserverMeaningIncrementContract() {
  return {
    version: worldSimulationObserverMeaningIncrementVersion,
    semantic_contract_source_version: characterCommunicationListenerUnderstandingVersion,
    source: "cc7j_listener_authored_lexical_increment_only",
    resolver_receives_current_and_prior_listener_recognized_surface_only: true,
    resolver_receives_future_fragment: false,
    resolver_receives_speaker_semantics: false,
    resolver_receives_real_speaker_identity: false,
    resolver_receives_source_action_or_sound_identity: false,
    interpretation_is_listener_subjective: true,
    partial_uncertain_or_no_interpretation_allowed: true,
    interpretation_may_differ_from_speaker_intent: true,
    no_resolver_means_no_incremental_interpretation: true,
    persistent_audit_contains_surface_or_meaning_text: false,
    grounding_claimed: false,
    belief_updated: false,
    world_truth_claimed: false,
    floor_or_interruption_decided: false,
    actual_mid_turn_world_action_replanning: false,
    fixed_timing_threshold_used: false,
  };
}

function empty(status, lexicalCount = 0, candidateCount = 0) {
  return {
    audit: {
      schema_version: worldSimulationObserverMeaningIncrementVersion,
      status,
      resolver_used: false,
      lexical_input_count: lexicalCount,
      candidate_count: candidateCount,
      interpretation_count: 0,
      interpretations: [],
      boundaries: buildWorldSimulationObserverMeaningIncrementContract(),
    },
    engine_private_meaning_increments: [],
  };
}

/**
 * CC-7K reuses CC-6C's listener-authored interpretation semantics, but moves
 * the admission point down to one already-released CC-7J lexical increment.
 * The transient resolver packet may accumulate only this observer's own past
 * recognized fragments for the same signal. It never receives the completed
 * source utterance, speaker semantics, identity, action/sound IDs, or future
 * fragments.
 */
export async function runWorldSimulationObserverMeaningIncrementAdmission({
  lexical_recognitions = [],
  resolver = null,
} = {}) {
  if (!Array.isArray(lexical_recognitions) || lexical_recognitions.length > 4096)
    reject("lexical_recognitions must be a bounded list.");
  if (resolver != null && typeof resolver !== "function")
    reject("resolver must be a callable observer meaning adapter.");

  const lexical = lexical_recognitions.map(normalizeLexicalIncrement)
    .sort((a, b) =>
      a.release_time_ms - b.release_time_ms
      || a.observer.localeCompare(b.observer, "en")
      || a.signal_ref.localeCompare(b.signal_ref, "en")
      || a.increment_ref.localeCompare(b.increment_ref, "en"));

  const seen = new Set();
  for (const item of lexical) {
    const key = JSON.stringify([
      item.observer, item.signal_ref, item.increment_ref, item.release_time_ms,
    ]);
    if (seen.has(key)) reject("Duplicate CC-7J lexical increment.");
    seen.add(key);
  }

  const candidates = lexical.filter((item) =>
    item.heard_surface_fragment !== null
    && item.lexical_intelligibility_attested === true);
  if (!resolver) return empty("resolver_not_installed", lexical.length, candidates.length);

  const prefixBySignal = new Map();
  const priorBySignal = new Map();
  const interpretations = [];
  const auditInterpretations = [];

  for (const item of candidates) {
    const signalKey = JSON.stringify([item.observer, item.signal_ref]);
    const priorFragments = prefixBySignal.get(signalKey) ?? [];
    const recognizedPrefix = [...priorFragments, item.heard_surface_fragment];
    prefixBySignal.set(signalKey, recognizedPrefix);

    const packet = {
      schema_version: worldSimulationObserverMeaningIncrementVersion,
      observer: item.observer,
      signal_ref: item.signal_ref,
      increment_ref: item.increment_ref,
      release_time_ms: item.release_time_ms,
      lexical_recognition_status: item.recognition_status,
      current_heard_surface_fragment: item.heard_surface_fragment,
      heard_surface_prefix: recognizedPrefix.join(""),
      prior_listener_interpretation: copy(priorBySignal.get(signalKey) ?? null),
      boundaries: {
        cc6c_subjective_interpretation_semantics_reused: true,
        source_identity_available: false,
        source_action_identity_available: false,
        source_sound_identity_available: false,
        source_semantics_available: false,
        future_fragment_available: false,
        world_truth_authority: false,
        grounding_authority: false,
        belief_write_authority: false,
        floor_or_interruption_authority: false,
        world_action_replanning_available: false,
      },
    };

    const raw = await resolver(copy(packet));
    if (raw == null) continue;
    const decision = normalizeDecision(raw);
    const identity = {
      version: worldSimulationObserverMeaningIncrementVersion,
      observer: item.observer,
      signal_ref: item.signal_ref,
      increment_ref: item.increment_ref,
      release_time_ms: item.release_time_ms,
      interpretation_status: decision.interpretation_status,
      interpreted_content: decision.interpreted_content,
      interpreted_interaction_function: decision.interpreted_interaction_function,
      understanding_attested: decision.understanding_attested,
      prior_interpretation_id:
        priorBySignal.get(signalKey)?.interpretation_id ?? null,
    };
    const interpretation = {
      schema_version: worldSimulationObserverMeaningIncrementVersion,
      interpretation_id:
        `observer_meaning_${hashAgentRunValue(identity).slice(0, 24)}`,
      observer: item.observer,
      signal_ref: item.signal_ref,
      increment_ref: item.increment_ref,
      release_time_ms: item.release_time_ms,
      source_lexical_recognition_status: item.recognition_status,
      interpretation_status: decision.interpretation_status,
      interpreted_content: decision.interpreted_content,
      interpreted_interaction_function: decision.interpreted_interaction_function,
      understanding_attested: decision.understanding_attested,
      prior_interpretation_id:
        priorBySignal.get(signalKey)?.interpretation_id ?? null,
      revises_prior_interpretation: priorBySignal.has(signalKey),
      subjective_only: true,
      interpretation_may_differ_from_speaker_intent: true,
      grounding_claimed: false,
      belief_updated: false,
      world_truth_claimed: false,
    };
    interpretations.push(interpretation);
    priorBySignal.set(signalKey, interpretation);
    auditInterpretations.push({
      observer_ref: `observer_${hashAgentRunValue({
        version: worldSimulationObserverMeaningIncrementVersion,
        observer: item.observer,
      }).slice(0, 24)}`,
      release_time_ms: item.release_time_ms,
      interpretation_status: decision.interpretation_status,
      interpreted_content_present: decision.interpreted_content !== null,
      interaction_function_present:
        decision.interpreted_interaction_function !== null,
      understanding_attested: decision.understanding_attested,
    });
  }

  return {
    audit: {
      schema_version: worldSimulationObserverMeaningIncrementVersion,
      status: "observer_subjective_incremental_meaning",
      resolver_used: true,
      lexical_input_count: lexical.length,
      candidate_count: candidates.length,
      interpretation_count: interpretations.length,
      interpretations: auditInterpretations,
      boundaries: buildWorldSimulationObserverMeaningIncrementContract(),
    },
    engine_private_meaning_increments: interpretations,
  };
}

export default runWorldSimulationObserverMeaningIncrementAdmission;
