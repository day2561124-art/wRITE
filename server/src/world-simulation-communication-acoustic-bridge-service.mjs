import { hashAgentRunValue } from "./agent-run-service.mjs";

export const worldSimulationCommunicationAcousticBridgeVersion =
  "cc6b-communication-acoustic-bridge-v1";

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function object(value) {
  return isObject(value) ? value : {};
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function finiteNonNegative(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function positive(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function acousticProfile(worldState, actor) {
  const character = object(object(worldState.characters)[actor]);
  const profile = object(character.speech_acoustics);
  const level = finiteNonNegative(profile.sound_level_db_at_1m);
  if (level === null || profile.enabled === false) return null;
  return {
    sound_level_db_at_1m: level,
    max_range_m: positive(profile.max_range_m),
  };
}

function sceneFor(worldState, sceneId) {
  return object(object(worldState.scenes)[sceneId] ?? worldState.scene_state);
}

function validCommittedSpeech(outcome) {
  const event = object(outcome.communication_event);
  const realization = object(event.surface_realization);
  const actionId = String(outcome.action_id ?? "").trim();
  const actor = String(outcome.actor ?? "").trim();
  return outcome.result === "communication_emitted"
    && actionId
    && actor
    && event.schema_version === "cc1-world-communication-event-v1"
    && event.actor === actor
    && event.channel === "speech"
    && event.surface_realization_complete === true
    && typeof event.surface_text === "string"
    && event.surface_text.trim().length > 0
    && realization.source_action_id === actionId
    && realization.surface_text === event.surface_text
    && realization.semantic_anchor === event.semantic_content;
}

function makeSignal({ worldState, sceneId, turnId, outcome }) {
  if (!validCommittedSpeech(outcome)) return { status: "not_realized_speech", signal: null };
  const actor = String(outcome.actor);
  const actionId = String(outcome.action_id);
  const scene = sceneFor(worldState, sceneId);
  const position = object(scene.entity_positions)[actor];
  if (!isObject(position)
    || !Number.isFinite(Number(position.x))
    || !Number.isFinite(Number(position.y))) {
    return { status: "speaker_position_unavailable", signal: null };
  }
  const profile = acousticProfile(worldState, actor);
  if (!profile) return { status: "explicit_speech_acoustics_unavailable", signal: null };

  const soundId = `communication_sound_${hashAgentRunValue({
    version: worldSimulationCommunicationAcousticBridgeVersion,
    turn_id: turnId ?? null,
    scene_id: sceneId,
    actor,
    action_id: actionId,
  }).slice(0, 24)}`;

  return {
    status: "registered",
    signal: {
      schema_version: worldSimulationCommunicationAcousticBridgeVersion,
      kind: "communication_speech_signal",
      sound_id: soundId,
      scene_id: sceneId,
      source_entity_id: actor,
      communication_action_id: actionId,
      sound_level_db_at_1m: profile.sound_level_db_at_1m,
      ...(profile.max_range_m !== null ? { max_range_m: profile.max_range_m } : {}),
      generic_auditory_label: "unidentified_speech_sound",
      lifecycle: "next_perception_only",
      created_turn_id: turnId ?? null,
      active: true,
      surface_text_exposed: false,
      semantic_content_exposed: false,
      speaker_identity_label_exposed: false,
      listener_understanding_inferred: false,
      world_truth_claimed: false,
      grounding_claimed: false,
    },
  };
}

/**
 * Produces the complete world.sound_events value for the next commit.
 * Existing CC-6B speech signals are removed because perception has already
 * had its single observation opportunity before the current causal resolve.
 * Non-CC-6B sound events are preserved unchanged.
 */
export function projectWorldSimulationCommunicationAcousticBridge(input = {}) {
  const worldState = object(input.world_state);
  const sceneId = String(input.scene_id ?? "").trim();
  const turnId = input.turn_id ?? null;
  const suppressed = new Set(array(input.suppressed_action_ids).map(String));
  const soundEventsFieldExists = Object.hasOwn(worldState, "sound_events");
  const beforeList = cloneJson(array(worldState.sound_events));
  const before = soundEventsFieldExists ? cloneJson(worldState.sound_events) : null;
  const preserved = beforeList.filter(
    (item) => object(item).schema_version !== worldSimulationCommunicationAcousticBridgeVersion,
  );
  const expired = beforeList
    .filter((item) => object(item).schema_version === worldSimulationCommunicationAcousticBridgeVersion)
    .map((item) => String(item?.sound_id ?? "")).filter(Boolean);

  const registrations = [];
  const skipped = [];
  for (const outcome of array(input.action_outcomes)) {
    const actionId = String(outcome?.action_id ?? "").trim();
    if (outcome?.result !== "communication_emitted") continue;
    if (suppressed.has(actionId)) {
      skipped.push({ action_id: actionId || null, actor: outcome?.actor ?? null, status: "suppressed_action" });
      continue;
    }
    const projected = makeSignal({
      worldState,
      sceneId,
      turnId,
      outcome: object(outcome),
    });
    if (!projected.signal) {
      skipped.push({
        action_id: actionId || null,
        actor: outcome?.actor ?? null,
        status: projected.status,
      });
      continue;
    }
    registrations.push({
      action_id: actionId,
      actor: outcome.actor,
      sound_id: projected.signal.sound_id,
      signal: projected.signal,
    });
  }

  registrations.sort((a, b) =>
    String(a.action_id).localeCompare(String(b.action_id), "en"));
  const nextList = [
    ...preserved,
    ...registrations.map((item) => cloneJson(item.signal)),
  ];
  const next = soundEventsFieldExists || nextList.length > 0 ? nextList : null;

  return {
    bridge_version: worldSimulationCommunicationAcousticBridgeVersion,
    before_sound_events: before,
    next_sound_events: next,
    registrations: registrations.map((item) => ({
      action_id: item.action_id,
      actor: item.actor,
      sound_id: item.sound_id,
    })),
    skipped,
    expired_sound_ids: expired.sort(),
    changed: JSON.stringify(before) !== JSON.stringify(next),
    boundary: {
      explicit_speaker_sound_level_required: true,
      hidden_default_vocal_level_allowed: false,
      registered_signal_contains_surface_text: false,
      registered_signal_contains_semantic_content: false,
      registered_signal_contains_listener_interpretation: false,
      speaker_identity_recognition_inferred: false,
      listener_comprehension_inferred: false,
      belief_update_inferred: false,
      grounding_inferred: false,
      one_next_perception_opportunity_only: true,
    },
  };
}

export function buildWorldSimulationCommunicationAcousticBridgeContract() {
  return {
    version: worldSimulationCommunicationAcousticBridgeVersion,
    owner: "programmatic_world_acoustics",
    source: "committed_realized_speech_outcomes_only",
    explicit_speaker_sound_level_required: true,
    hidden_default_vocal_level_allowed: false,
    same_scene_source_position_required: true,
    suppressed_actions_register_signal: false,
    signal_lifecycle: "one_next_perception_only",
    source_content_forwarded_to_audibility: false,
    speaker_identity_recognition_inferred: false,
    speech_intelligibility_inferred: false,
    listener_understanding_inferred: false,
    listener_belief_inferred: false,
    conversational_grounding_inferred: false,
  };
}
