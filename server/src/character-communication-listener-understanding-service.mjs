import { hashAgentRunValue } from "./agent-run-service.mjs";
import {
  admitCharacterCommunicationListenerInterpretation,
  projectCharacterCommunicationListenerReception,
} from "./character-communication-listener-reception-service.mjs";
import {
  worldSimulationCommunicationAcousticBridgeVersion,
} from "./world-simulation-communication-acoustic-bridge-service.mjs";

export const characterCommunicationListenerUnderstandingVersion =
  "cc6c-listener-speech-understanding-v1";
export const characterCommunicationListenerUnderstandingResolverViewVersion =
  "cc6c-listener-speech-resolver-view-v1";

function record(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function boundedText(value, name, limit = 600) {
  if (typeof value !== "string") throw new Error(`${name} must be text.`);
  const result = value.trim();
  if (!result || [...result].length > limit) {
    throw new Error(`${name} is missing or out of bounds.`);
  }
  return result;
}

function priorCommittedOutcomes(worldHistory) {
  return list(worldHistory?.turns).flatMap((turn) =>
    list(turn?.action_outcomes).map((outcome) => ({
      turn_id: turn?.turn_id ?? null,
      outcome,
    })));
}

function exactCommittedOutcome(worldHistory, actionId, speaker) {
  const matches = priorCommittedOutcomes(worldHistory).filter(({ outcome }) =>
    record(outcome)
    && outcome.action_id === actionId
    && outcome.actor === speaker
    && outcome.result === "communication_emitted"
    && record(outcome.communication_event)
    && outcome.communication_event.schema_version === "cc1-world-communication-event-v1"
    && outcome.communication_event.channel === "speech"
    && outcome.communication_event.surface_realization_complete === true
  );
  return matches.length === 1 ? matches[0] : null;
}

function exactBridgeSignal(worldState, soundId) {
  const matches = list(worldState?.sound_events).filter((item) =>
    record(item)
    && item.schema_version === worldSimulationCommunicationAcousticBridgeVersion
    && item.kind === "communication_speech_signal"
    && item.sound_id === soundId
    && item.lifecycle === "next_perception_only"
    && item.active !== false
  );
  return matches.length === 1 ? matches[0] : null;
}

function safeAuditoryObservation(audibilityResult, soundId) {
  const sounds = list(audibilityResult?.audible_sounds);
  const index = sounds.findIndex((item) => item?.sound_id === soundId);
  if (index < 0) return null;
  const item = list(audibilityResult?.perception_auditory_observations)[index];
  if (!record(item)) return null;
  return {
    sense: item.sense ?? "auditory",
    kind: item.kind ?? "audible_sound",
    perceptual_label: item.perceptual_label ?? "unidentified_sound",
    ...(typeof item.relative_direction_sector === "string"
      ? { relative_direction_sector: item.relative_direction_sector }
      : {}),
    localization_is_coarse: item.localization_is_coarse === true,
  };
}

/**
 * Builds a listener-only resolver surface from already committed speech that
 * is physically audible in the current turn.
 *
 * The resolver may see the emitted public surface signal because that is the
 * symbolic stand-in for the actual acoustic speech pattern. It does NOT see
 * the speaker's semantic_content, private purpose, engine identity, source
 * action id, world truth, or listener belief state.
 */
export function buildCharacterCommunicationListenerUnderstandingResolverView(input = {}) {
  const observer = boundedText(input.observer, "observer", 240);
  const worldState = record(input.world_state) ? input.world_state : {};
  const scene = record(input.scene_state) ? input.scene_state : {};
  const sceneId = boundedText(input.scene_id ?? scene.scene_id, "scene_id", 240);
  const history = record(input.world_history) ? input.world_history : {};
  const audibilityResult = record(input.audibility_result) ? input.audibility_result : {};

  const candidates = [];
  const engineCandidates = [];
  const skips = [];

  for (const audible of list(audibilityResult.audible_sounds)) {
    const soundId = String(audible?.sound_id ?? "").trim();
    if (!soundId) continue;
    const signal = exactBridgeSignal(worldState, soundId);
    if (!signal) continue;

    const actionId = String(signal.communication_action_id ?? "").trim();
    const speaker = String(signal.source_entity_id ?? "").trim();
    if (!actionId || !speaker || speaker === observer) {
      skips.push({ sound_id: soundId, reason: "invalid_or_self_source_lineage" });
      continue;
    }

    const source = exactCommittedOutcome(history, actionId, speaker);
    if (!source) {
      skips.push({ sound_id: soundId, reason: "committed_source_outcome_not_unique" });
      continue;
    }

    let reception;
    try {
      reception = projectCharacterCommunicationListenerReception({
        observer,
        sound_id: soundId,
        scene_id: sceneId,
        scene_state: scene,
        world_state: worldState,
        committed_outcome: source.outcome,
      });
    } catch {
      skips.push({ sound_id: soundId, reason: "listener_reception_admission_failed" });
      continue;
    }
    if (reception.admission_status !== "heard_sound_only"
      || !record(reception.character_view)) {
      skips.push({ sound_id: soundId, reason: reception.admission_status ?? "not_admitted" });
      continue;
    }

    const event = source.outcome.communication_event;
    const surface = boundedText(event.surface_text, "emitted surface", 600);
    const surfaceRealization = record(event.surface_realization)
      ? event.surface_realization : {};
    const acousticObservation = safeAuditoryObservation(audibilityResult, soundId);
    if (!acousticObservation) {
      skips.push({ sound_id: soundId, reason: "safe_auditory_observation_missing" });
      continue;
    }

    const candidateId = `listener_speech_${hashAgentRunValue({
      version: characterCommunicationListenerUnderstandingVersion,
      observer,
      source_turn_id: source.turn_id,
      source_action_id: actionId,
      source_sound_id: soundId,
    }).slice(0, 24)}`;

    candidates.push({
      schema_version: characterCommunicationListenerUnderstandingResolverViewVersion,
      speech_candidate_id: candidateId,
      observer,
      channel: "speech",
      emitted_surface_signal: surface,
      signal_language: surfaceRealization.language ?? null,
      acoustic_observation: acousticObservation,
      source_identity_available: false,
      speaker_semantic_content_available: false,
      speaker_private_purpose_available: false,
      world_truth_available: false,
      listener_belief_state_available: false,
      resolver_may_report_partial_or_mistaken_recognition: true,
    });
    engineCandidates.push({
      speech_candidate_id: candidateId,
      source_turn_id: source.turn_id,
      source_action_id: actionId,
      source_sound_id: soundId,
      source_speaker: speaker,
      reception,
    });
  }

  return {
    version: characterCommunicationListenerUnderstandingVersion,
    observer,
    resolver_view: {
      schema_version: characterCommunicationListenerUnderstandingResolverViewVersion,
      observer,
      speech_candidates: cloneJson(candidates),
      boundary: {
        emitted_public_surface_signal_only: true,
        speaker_semantic_content_exposed: false,
        speaker_private_purpose_exposed: false,
        source_engine_identity_exposed: false,
        source_action_identity_exposed: false,
        world_truth_exposed: false,
        no_candidate_means_no_listener_interpretation: true,
      },
    },
    engine_context: {
      candidates: engineCandidates,
      skips,
    },
  };
}

const decisionKeys = new Set([
  "speech_candidate_id",
  "heard_surface",
  "interpreted_content",
  "speech_content_intelligible",
  "understanding_attested",
]);

/**
 * Admits only explicit listener-authored resolver results. Mishearing and
 * partial interpretation are allowed. Speaker identity is intentionally not
 * supported in CC-6C, so this phase cannot issue CC-2 understood testimony.
 */
export function projectCharacterCommunicationListenerUnderstanding(input = {}) {
  const assembly = record(input.assembly) ? input.assembly : {};
  if (assembly.version !== characterCommunicationListenerUnderstandingVersion
    || !record(assembly.resolver_view)
    || !record(assembly.engine_context)) {
    throw new Error("CC-6C requires a canonical listener-understanding assembly.");
  }

  const observer = boundedText(assembly.observer, "observer", 240);
  const engineCandidates = list(assembly.engine_context.candidates);
  const byId = new Map(engineCandidates.map((item) => [item.speech_candidate_id, item]));
  const decisions = list(input.decisions);
  const seen = new Set();
  const characterViews = [];
  const audits = [];

  for (const raw of decisions) {
    if (!record(raw)) throw new Error("CC-6C resolver decisions must be structured objects.");
    for (const key of Object.keys(raw)) {
      if (!decisionKeys.has(key)) {
        throw new Error(`CC-6C resolver decision field is not allowed: ${key}`);
      }
    }
    const candidateId = boundedText(raw.speech_candidate_id, "speech_candidate_id", 120);
    if (seen.has(candidateId)) throw new Error("CC-6C resolver decision duplicates a speech candidate.");
    seen.add(candidateId);
    const engine = byId.get(candidateId);
    if (!engine) throw new Error("CC-6C resolver decision references an unknown speech candidate.");

    const interpreted = admitCharacterCommunicationListenerInterpretation(
      engine.reception,
      {
        observer,
        source_action_id: engine.source_action_id,
        heard_surface: boundedText(raw.heard_surface, "heard_surface", 600),
        interpreted_content: boundedText(raw.interpreted_content, "interpreted_content", 600),
        perceived_speaker: null,
        perceived_speaker_recognized: false,
        speech_content_intelligible: raw.speech_content_intelligible === true,
        understanding_attested: raw.understanding_attested === true,
      },
    );

    characterViews.push({
      ...cloneJson(interpreted.character_view),
      schema_version: characterCommunicationListenerUnderstandingVersion,
      source: "listener_authored_speech_recognition",
      speaker_identity_recognized: false,
      perceived_speaker: null,
      cc2_understood_testimony_eligible: false,
    });
    audits.push({
      speech_candidate_id: candidateId,
      source_turn_id: engine.source_turn_id,
      source_action_id: engine.source_action_id,
      source_sound_id: engine.source_sound_id,
      source_speaker: engine.source_speaker,
      reception_verified: true,
      interpretation_subjective_only: true,
      speaker_identity_recognized: false,
      understood_testimony_issued: false,
      grounding_claimed: false,
    });
  }

  return {
    version: characterCommunicationListenerUnderstandingVersion,
    observer,
    candidate_count: engineCandidates.length,
    decision_count: decisions.length,
    character_views: characterViews,
    audit: {
      decisions: audits,
      no_resolver_decision_means_no_interpretation: true,
      speaker_identity_recognition_supported: false,
      understood_testimony_issued: false,
      belief_update_performed: false,
      world_truth_claimed: false,
      grounding_claimed: false,
    },
  };
}

export function buildCharacterCommunicationListenerUnderstandingContract() {
  return {
    version: characterCommunicationListenerUnderstandingVersion,
    owner: "observer_specific_listener_interpretation",
    source_requires_prior_committed_realized_speech: true,
    source_requires_current_programmatic_audibility: true,
    resolver_receives_emitted_public_surface_signal: true,
    resolver_receives_speaker_semantic_content: false,
    resolver_receives_speaker_private_purpose: false,
    resolver_receives_source_engine_identity: false,
    resolver_receives_source_action_identity: false,
    no_resolver_means_no_interpretation: true,
    mishearing_and_partial_interpretation_allowed: true,
    speaker_identity_recognition_supported: false,
    understood_testimony_issued: false,
    belief_update_performed: false,
    world_truth_claimed: false,
    grounding_claimed: false,
  };
}
