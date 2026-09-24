import { hashAgentRunValue } from "./agent-run-service.mjs";
import { projectCharacterCommunicationTurnProjection } from "./character-communication-turn-projection-service.mjs";
import {
  projectCharacterCommunicationTurnParticipationIntent,
  buildCharacterCommunicationTurnParticipationIntentContract,
} from "./character-communication-turn-participation-intent-service.mjs";
import { worldSimulationObserverSpeechIncrementVersion } from "./world-simulation-communication-observer-increment-service.mjs";
import { worldSimulationObserverLexicalIncrementVersion } from "./world-simulation-communication-observer-lexical-increment-service.mjs";
import { worldSimulationObserverMeaningIncrementVersion } from "./world-simulation-communication-observer-meaning-increment-service.mjs";

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

function lexicalRecognitionKey(item) {
  return JSON.stringify([
    item.observer,
    item.signal_ref,
    item.increment_ref,
    item.release_time_ms,
  ]);
}

function lexicalRecognitionMap(value) {
  if (!Array.isArray(value) || value.length > 4096)
    invalid("lexical_recognitions must be a bounded list.");
  const result = new Map();
  for (const item of value) {
    exactKeys(item, [
      "schema_version", "observer", "signal_ref", "increment_ref",
      "release_time_ms", "recognition_status", "heard_surface_fragment",
      "lexical_intelligibility_attested", "subjective_only",
    ], "CC-7J lexical recognition");
    if (item.schema_version !== worldSimulationObserverLexicalIncrementVersion
        || typeof item.observer !== "string" || !item.observer.trim()
        || typeof item.signal_ref !== "string" || !item.signal_ref.trim()
        || typeof item.increment_ref !== "string" || !item.increment_ref.trim()
        || !Number.isFinite(item.release_time_ms) || item.release_time_ms < 0
        || !["recognized", "partial", "uncertain", "unintelligible"].includes(item.recognition_status)
        || item.subjective_only !== true
        || (item.heard_surface_fragment === null
          ? item.lexical_intelligibility_attested !== false
          : (typeof item.heard_surface_fragment !== "string"
            || !item.heard_surface_fragment.trim()
            || [...item.heard_surface_fragment.trim()].length > 1200
            || item.lexical_intelligibility_attested !== true)))
      invalid("CC-7D received an invalid CC-7J lexical recognition.");
    const key = lexicalRecognitionKey(item);
    if (result.has(key)) invalid("Duplicate CC-7J lexical recognition.");
    result.set(key, item);
  }
  return result;
}

function meaningInterpretationMap(value) {
  if (!Array.isArray(value) || value.length > 4096)
    invalid("meaning_interpretations must be a bounded list.");
  const result = new Map();
  for (const item of value) {
    exactKeys(item, [
      "schema_version", "interpretation_id", "observer", "signal_ref",
      "increment_ref", "release_time_ms", "source_lexical_recognition_status",
      "interpretation_status", "interpreted_content",
      "interpreted_interaction_function", "understanding_attested",
      "prior_interpretation_id", "revises_prior_interpretation",
      "subjective_only", "interpretation_may_differ_from_speaker_intent",
      "grounding_claimed", "belief_updated", "world_truth_claimed",
    ], "CC-7K meaning interpretation");
    const hasContent = typeof item.interpreted_content === "string"
      && item.interpreted_content.trim()
      && [...item.interpreted_content.trim()].length <= 1200;
    const hasInteractionFunction = item.interpreted_interaction_function == null
      || (typeof item.interpreted_interaction_function === "string"
        && item.interpreted_interaction_function.trim()
        && [...item.interpreted_interaction_function.trim()].length <= 240);
    if (item.schema_version !== worldSimulationObserverMeaningIncrementVersion
        || typeof item.interpretation_id !== "string" || !item.interpretation_id.trim()
        || typeof item.observer !== "string" || !item.observer.trim()
        || typeof item.signal_ref !== "string" || !item.signal_ref.trim()
        || typeof item.increment_ref !== "string" || !item.increment_ref.trim()
        || !Number.isFinite(item.release_time_ms) || item.release_time_ms < 0
        || !["recognized", "partial", "uncertain"].includes(item.source_lexical_recognition_status)
        || !["interpreted", "partial", "uncertain", "uninterpreted"].includes(item.interpretation_status)
        || (item.interpretation_status === "uninterpreted"
          ? item.interpreted_content !== null
          : !hasContent)
        || !hasInteractionFunction
        || typeof item.understanding_attested !== "boolean"
        || (item.understanding_attested && item.interpretation_status !== "interpreted")
        || (item.prior_interpretation_id != null
          && (typeof item.prior_interpretation_id !== "string"
            || !item.prior_interpretation_id.trim()))
        || typeof item.revises_prior_interpretation !== "boolean"
        || item.subjective_only !== true
        || item.interpretation_may_differ_from_speaker_intent !== true
        || item.grounding_claimed !== false
        || item.belief_updated !== false
        || item.world_truth_claimed !== false)
      invalid("CC-7D received an invalid CC-7K meaning interpretation.");
    const expectedInterpretationId =
      `observer_meaning_${hashAgentRunValue({
        version: worldSimulationObserverMeaningIncrementVersion,
        observer: item.observer,
        signal_ref: item.signal_ref,
        increment_ref: item.increment_ref,
        release_time_ms: item.release_time_ms,
        interpretation_status: item.interpretation_status,
        interpreted_content: item.interpreted_content,
        interpreted_interaction_function: item.interpreted_interaction_function,
        understanding_attested: item.understanding_attested,
        prior_interpretation_id: item.prior_interpretation_id,
      }).slice(0, 24)}`;
    if (item.interpretation_id !== expectedInterpretationId)
      invalid("CC-7K meaning interpretation identity does not match its contents.");
    const key = lexicalRecognitionKey(item);
    if (result.has(key)) invalid("Duplicate CC-7K meaning interpretation.");
    result.set(key, item);
  }
  return result;
}

export function buildWorldSimulationTurnIncrementHandoffContract() {
  return {
    version: worldSimulationTurnIncrementHandoffVersion,
    source: "cc7c_admitted_observer_cues_only",
    one_release_per_observer_resolver_invocation: true,
    observer_receives_future_releases: false,
    real_speaker_identity_forwarded: false,
    anonymous_speaker_ref_is_not_recognition: true,
    engine_source_surface_forwarded_without_listener_recognition: false,
    listener_authored_lexical_fragment_supported: true,
    lexical_recognition_source_version: worldSimulationObserverLexicalIncrementVersion,
    listener_authored_incremental_meaning_supported: true,
    meaning_interpretation_source_version: worldSimulationObserverMeaningIncrementVersion,
    meaning_interpretation_does_not_claim_grounding_or_belief: true,
    observer_participation_intention:
      buildCharacterCommunicationTurnParticipationIntentContract(),
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
  lexical_recognitions = [],
  meaning_interpretations = [],
  resolver = null,
} = {}) {
  if (!Array.isArray(admissions) || admissions.length > 4096)
    invalid("admissions must be a bounded list.");
  const lexicalByIncrement = lexicalRecognitionMap(lexical_recognitions);
  const meaningByIncrement = meaningInterpretationMap(meaning_interpretations);
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
  const priorMeaningBySignal = new Map();
  const priorParticipationBySignal = new Map();
  const projections = [];
  const consumedLexicalRecognitionKeys = new Set();
  const consumedMeaningInterpretationKeys = new Set();

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
    const lexicalKey = lexicalRecognitionKey({
      observer: cue.observer,
      signal_ref: cue.signal_ref,
      increment_ref: cue.increment_ref,
      release_time_ms: receipt.release_time_ms,
    });
    const lexicalRecognition = lexicalByIncrement.get(lexicalKey) ?? null;
    if (lexicalRecognition) consumedLexicalRecognitionKeys.add(lexicalKey);
    const meaningInterpretation = meaningByIncrement.get(lexicalKey) ?? null;
    if (meaningInterpretation) {
      if (!lexicalRecognition
          || meaningInterpretation.source_lexical_recognition_status
            !== lexicalRecognition.recognition_status)
        invalid("CC-7K meaning interpretation must match its CC-7J lexical recognition.");
      const priorMeaning = priorMeaningBySignal.get(key) ?? null;
      if (priorMeaning) {
        if (meaningInterpretation.revises_prior_interpretation !== true
            || meaningInterpretation.prior_interpretation_id
              !== priorMeaning.interpretation_id)
          invalid("CC-7K meaning interpretation must continue the same signal lineage.");
      } else if (meaningInterpretation.revises_prior_interpretation !== false
          || meaningInterpretation.prior_interpretation_id !== null) {
        invalid("First CC-7K meaning interpretation cannot claim prior lineage.");
      }
      priorMeaningBySignal.set(key, meaningInterpretation);
      consumedMeaningInterpretationKeys.add(lexicalKey);
    }
    const perceivedIncrement = {
      schema_version: "cc7-observer-speech-increment-v1",
      observer: cue.observer,
      speaker: anonymousSpeaker,
      signal_ref: cue.signal_ref,
      increment_ref: cue.increment_ref,
      heard_surface_fragment:
        lexicalRecognition?.heard_surface_fragment ?? null,
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
      prior_participation_intent: copy(priorParticipationBySignal.get(key) ?? null),
      evidence_is_nonlexical_only:
        lexicalRecognition?.heard_surface_fragment == null,
      lexical_recognition_status:
        lexicalRecognition?.recognition_status ?? null,
      incremental_meaning_interpretation: meaningInterpretation
        ? {
          interpretation_id: meaningInterpretation.interpretation_id,
          interpretation_status: meaningInterpretation.interpretation_status,
          interpreted_content: meaningInterpretation.interpreted_content,
          interpreted_interaction_function:
            meaningInterpretation.interpreted_interaction_function,
          understanding_attested: meaningInterpretation.understanding_attested,
          prior_interpretation_id: meaningInterpretation.prior_interpretation_id,
          revises_prior_interpretation:
            meaningInterpretation.revises_prior_interpretation,
          subjective_only: true,
          grounding_claimed: false,
          belief_updated: false,
        }
        : null,
      meaning_interpretation_status:
        meaningInterpretation?.interpretation_status ?? null,
      world_action_replanning_available: false,
    };
    const raw = await resolver(copy(view));
    if (raw == null) continue; // Observer may remain silent without projection.
    exactKeys(raw, [
      "listener_decision", "response_preparation_context",
      "participation_decision",
    ], "observer decision");
    if (!record(raw.listener_decision)) invalid("Observer must supply a bounded CC-7A decision.");
    const projection = projectCharacterCommunicationTurnProjection({
      observer: cue.observer,
      perceived_speech_increment: perceivedIncrement,
      listener_decision: raw.listener_decision,
      response_preparation_context: raw.response_preparation_context ?? null,
      prior_state: prior,
    });
    const participation = raw.participation_decision == null
      ? null
      : projectCharacterCommunicationTurnParticipationIntent({
        observer: cue.observer,
        turn_projection: projection,
        participation_decision: raw.participation_decision,
        prior_state: priorParticipationBySignal.get(key) ?? null,
      });
    priorBySignal.set(key, projection);
    if (participation) priorParticipationBySignal.set(key, participation);
    else priorParticipationBySignal.delete(key);
    projections.push({
      schema_version: worldSimulationTurnIncrementHandoffVersion,
      observer: cue.observer,
      release_time_ms: receipt.release_time_ms,
      projection: copy(projection),
      participation_intent: copy(participation),
      source_meaning_interpretation_id:
        meaningInterpretation?.interpretation_id ?? null,
      subjective_only: true,
      actual_world_action_replanned: false,
    });
  }

  if (consumedLexicalRecognitionKeys.size !== lexicalByIncrement.size)
    invalid("CC-7J lexical recognition does not match an admitted observer increment.");
  if (consumedMeaningInterpretationKeys.size !== meaningByIncrement.size)
    invalid("CC-7K meaning interpretation does not match an admitted observer increment.");

  return copy({
    schema_version: worldSimulationTurnIncrementHandoffVersion,
    resolver_used: true,
    projected_count: projections.length,
    projections,
    boundaries: buildWorldSimulationTurnIncrementHandoffContract(),
  });
}
