import {
  queryWorldSimulationObserverAudibility,
  worldSimulationAudibilityQueryVersion,
} from "./world-simulation-audibility-query-service.mjs";

export const characterCommunicationListenerReceptionVersion =
  "cc6a-bounded-listener-reception-v1";

function record(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function boundedText(value, name, limit = 600) {
  if (typeof value !== "string") throw new Error(name + " must be text.");
  const result = value.trim();
  if (!result || [...result].length > limit) throw new Error(name + " is missing or out of bounds.");
  return result;
}

function soundSources(worldState, scene, sceneId) {
  const local = [
    ...list(scene.sound_events),
    ...list(scene.auditory_events),
    ...list(scene.sound_sources),
  ];
  const global = [
    ...list(worldState.sound_events),
    ...list(worldState.auditory_events),
  ].filter((item) => record(item) && (
    item.scene_id == null && item.location_id == null
    || String(item.scene_id ?? item.location_id) === sceneId
  ));
  return [...local, ...global];
}

/**
 * CC-6A: a read-only admission boundary for ONE prior committed speaker
 * outcome and ONE explicit acoustic source. This does not register sounds or
 * generate a listener's interpretation. The native World loop must wire
 * committed speech to its sound source in a later batch.
 *
 * The authoritative Phase62Z query establishes audibility ONLY; its output
 * cannot prove word intelligibility, source recognition, belief or grounding.
 */
export function projectCharacterCommunicationListenerReception(input = {}) {
  const observer = boundedText(input.observer, "observer", 240);
  const scene = record(input.scene_state) ? input.scene_state : {};
  const worldState = record(input.world_state) ? input.world_state : {};
  const sceneId = boundedText(input.scene_id ?? scene.scene_id, "scene_id", 240);
  const soundId = boundedText(input.sound_id, "sound_id", 240);
  const outcome = record(input.committed_outcome) ? input.committed_outcome : {};
  const event = record(outcome.communication_event) ? outcome.communication_event : {};
  const actionId = boundedText(outcome.action_id, "source action_id", 240);
  const speaker = boundedText(outcome.actor, "source actor", 240);

  if (observer === speaker) throw new Error("A speaker cannot receive their own listener receipt.");
  if (outcome.result !== "communication_emitted"
    || event.schema_version !== "cc1-world-communication-event-v1"
    || event.actor !== speaker
    || event.channel !== "speech"
    || event.surface_realization_complete !== true
    || !record(event.surface_realization)
    || event.surface_realization.source_action_id !== actionId
    || event.surface_realization.surface_text !== event.surface_text
    || event.surface_realization.semantic_anchor !== event.semantic_content) {
    throw new Error("Listener reception requires a committed, realized speech outcome.");
  }

  // Even a real sound may be unrelated to this particular committed action.
  // A generic nearby sound or World-unique speaker ID cannot be a receipt.
  const soundCandidates = soundSources(worldState, scene, sceneId).filter((item) =>
    record(item) && String(item.sound_id ?? item.id ?? "") === soundId
  );
  if (soundCandidates.length !== 1
    || soundCandidates[0].communication_action_id !== actionId
    || soundCandidates[0].source_entity_id !== speaker
    || (soundCandidates[0].scene_id != null
      && soundCandidates[0].scene_id !== sceneId))
    throw new Error("Exactly one explicitly action-linked source sound is required.");

  const query = queryWorldSimulationObserverAudibility({
    world_state: worldState,
    scene_state: scene,
    scene_id: sceneId,
    observer,
  });
  const result = query.result;
  if (result.observer !== observer || !result.audibility_enforced)
    return { schema_version: characterCommunicationListenerReceptionVersion,
      observer, character_view: null, admission_status: "acoustic_evidence_unavailable",
      audit: { sound_query_version: worldSimulationAudibilityQueryVersion,
        action_link_verified: true, audible: false } };

  const hit = result.audible_sounds.find((item) => item.sound_id === soundId);
  if (!hit) return { schema_version: characterCommunicationListenerReceptionVersion,
    observer, character_view: null, admission_status: "not_audible",
    audit: { sound_query_version: worldSimulationAudibilityQueryVersion,
      action_link_verified: true, audible: false } };

  // The character-facing receipt is deliberately free of engine sound IDs,
  // source position, dB, speaker identity, hidden propositions or verbatim
  // surface_text. It attests only that this observer heard a speech SOUND.
  const index = result.audible_sounds.findIndex((item) => item.sound_id === soundId);
  const sensory = result.perception_auditory_observations[index];
  const characterView = {
    schema_version: characterCommunicationListenerReceptionVersion,
    kind: "heard_speech_signal",
    observer,
    sense: "auditory",
    perceptual_label: sensory?.perceptual_label ?? "unidentified_sound",
    speech_content_intelligible: false,
    speaker_identity_recognized: false,
    listener_understanding_attested: false,
    interpretation: null,
    source_semantics_forwarded: false,
    belief_updated: false,
    world_truth_claimed: false,
    grounding_claimed: false,
  };
  return {
    schema_version: characterCommunicationListenerReceptionVersion,
    observer,
    admission_status: "heard_sound_only",
    character_view: characterView,
    audit: {
      sound_query_version: worldSimulationAudibilityQueryVersion,
      action_link_verified: true,
      source_action_id: actionId,
      source_sound_id: soundId,
      source_speaker: speaker,
      source_event_committed: true,
      audible: true,
      intelligibility_modeled_by_acoustic_query: false,
    },
  };
}

/**
 * The listener's own report may be mistaken, uncertain, or incomplete.
 * Neither accurate text nor source identity is inferred from acoustic volume
 * or from the speaker's intended meaning. No CC-2 understood-testimony
 * receipt is generated here: interpretation is not verified comprehension.
 */
export function admitCharacterCommunicationListenerInterpretation(reception, report) {
  if (!record(reception)
    || reception.schema_version !== characterCommunicationListenerReceptionVersion
    || reception.admission_status !== "heard_sound_only"
    || !record(reception.character_view)
    || reception.audit?.audible !== true)
    throw new Error("Listener interpretation requires admitted audible-speech evidence.");
  if (!record(report)) throw new Error("Listener report must be explicitly structured.");
  const observer = boundedText(reception.observer, "observer", 240);
  if (report.observer !== observer)
    throw new Error("Listener interpretation cannot borrow another observer's report.");
  if (report.source_action_id !== reception.audit.source_action_id)
    throw new Error("Listener interpretation must bind to the admitted source action.");

  const heardSurface = boundedText(report.heard_surface, "heard_surface");
  const interpretedContent = boundedText(report.interpreted_content, "interpreted_content");
  const perceivedSpeaker = report.perceived_speaker == null
    ? null : boundedText(report.perceived_speaker, "perceived_speaker", 240);
  if (report.understanding_attested === true
    && report.speech_content_intelligible !== true)
    throw new Error("Understanding cannot be attested while speech is reported unintelligible.");
  if (report.perceived_speaker != null && report.perceived_speaker_recognized !== true)
    throw new Error("A perceived speaker label requires explicit listener recognition.");
  if (report.perceived_speaker_recognized === true && !perceivedSpeaker)
    throw new Error("Recognized speaker requires an explicitly named perception.");

  const characterView = {
    ...reception.character_view,
    kind: "subjectively_interpreted_speech",
    heard_surface: heardSurface,
    interpreted_content: interpretedContent,
    perceived_speaker: perceivedSpeaker,
    speech_content_intelligible: report.speech_content_intelligible === true,
    speaker_identity_recognized: report.perceived_speaker_recognized === true,
    listener_understanding_attested: report.understanding_attested === true,
    interpretation: "observer_authored_unverified",
    interpretation_may_differ_from_speaker_intent: true,
  };
  // An explicit report is a subjective claim, never the World adjudicator's
  // factual certification of the speaker's actual wording or intention.
  return {
    schema_version: characterCommunicationListenerReceptionVersion,
    observer,
    admission_status: "listener_interpretation_reported",
    character_view: characterView,
    audit: {
      ...reception.audit,
      interpretation_authority: "same_observer_report",
      interpretation_equivalence_verified: false,
      understood_testimony_issued: false,
    },
  };
}
