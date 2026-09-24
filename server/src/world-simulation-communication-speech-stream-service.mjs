import { hashAgentRunValue } from "./agent-run-service.mjs";

export const worldSimulationCommunicationSpeechStreamVersion =
  "cc7b-communication-speech-temporal-stream-v1";

const isRecord = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const object = (value) => isRecord(value) ? value : {};
const copy = (value) => JSON.parse(JSON.stringify(value ?? null));

function fail(message) {
  const error = new Error(message);
  error.code = "WORLD_SIMULATION_COMMUNICATION_SPEECH_STREAM_INVALID";
  throw error;
}

function boundedText(value, label, maxChars = 1200) {
  if (typeof value !== "string" || !value.trim())
    fail(`${label} must be a nonblank string.`);
  const normalized = value.trim();
  if ([...normalized].length > maxChars)
    fail(`${label} exceeds its bounded length.`);
  return normalized;
}

function positiveFinite(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0)
    fail(`${label} must be a positive finite number.`);
  return number;
}

function boundedPositiveInteger(value, label, max = 64) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > max)
    fail(`${label} must be an integer from 1 to ${max}.`);
  return number;
}

function validCommittedSpeechOutcome(outcome) {
  if (!isRecord(outcome) || outcome.result !== "communication_emitted")
    return false;
  const event = object(outcome.communication_event);
  const realization = object(event.surface_realization);
  const actionId = String(outcome.action_id ?? "").trim();
  const actor = String(outcome.actor ?? "").trim();
  return Boolean(
    actionId
    && actor
    && event.schema_version === "cc1-world-communication-event-v1"
    && event.actor === actor
    && event.channel === "speech"
    && event.surface_realization_complete === true
    && typeof event.surface_text === "string"
    && event.surface_text.trim().length > 0
    && realization.source_action_id === actionId
    && realization.surface_text === event.surface_text,
  );
}

function technicalFragments(surfaceText, maxChars) {
  const units = [...surfaceText];
  const fragments = [];
  for (let index = 0; index < units.length; index += maxChars) {
    fragments.push(units.slice(index, index + maxChars).join(""));
  }
  return fragments;
}

export function buildWorldSimulationCommunicationSpeechStreamContract() {
  return {
    version: worldSimulationCommunicationSpeechStreamVersion,
    owner: "programmatic_world_communication_timeline",
    source: "committed_realized_speech_outcome_only",
    exact_public_surface_reconstructed: true,
    technical_increment_segmentation_only: true,
    engine_holds_complete_release_schedule: true,
    world_owned_start_time_anchor_supported: true,
    observer_release_gate_required: true,
    listener_increment_consumption_implemented_here: false,
    segmentation_is_psychological_boundary: false,
    phonetic_boundary_claimed: false,
    prosodic_boundary_claimed: false,
    listener_audibility_inferred: false,
    listener_heard_surface_inferred: false,
    listener_understanding_inferred: false,
    speaker_hidden_intent_exposed: false,
    semantic_content_forwarded_in_increment: false,
    private_purpose_forwarded_in_increment: false,
    world_truth_claimed: false,
    grounding_claimed: false,
    floor_arbitration_performed: false,
    interruption_judgment_performed: false,
  };
}

/**
 * CC-7B creates an engine-side temporal stream from a speech action whose
 * public surface has already been fully selected and validated by the speaker
 * path. This is a transport schedule, not a listener perception result.
 *
 * The segmentation budget is explicitly technical. A fragment boundary does
 * not mean a clause boundary, turn-completion point, prosodic boundary, or
 * psychological threshold. Later observer-side processing may consume only
 * increments whose release time has actually been reached.
 */
export function projectWorldSimulationCommunicationSpeechStream({
  outcome,
  technical_increment_max_chars = 6,
  start_time_ms = 0,
} = {}) {
  if (!validCommittedSpeechOutcome(outcome))
    fail("CC-7B requires one committed realized speech outcome.");

  const actionId = boundedText(outcome.action_id, "outcome.action_id", 240);
  const actor = boundedText(outcome.actor, "outcome.actor", 240);
  const event = object(outcome.communication_event);
  const surfaceText = boundedText(event.surface_text, "communication_event.surface_text", 1200);
  const durationMs = positiveFinite(outcome.duration_ms, "outcome.duration_ms");
  const maxChars = boundedPositiveInteger(
    technical_increment_max_chars,
    "technical_increment_max_chars",
  );
  if (!Number.isFinite(start_time_ms) || start_time_ms < 0
      || start_time_ms > 3600000)
    fail("start_time_ms must be a bounded World-owned release anchor.");

  const fragments = technicalFragments(surfaceText, maxChars);
  if (fragments.length === 0)
    fail("CC-7B speech stream must contain at least one increment.");

  const streamIdentity = {
    version: worldSimulationCommunicationSpeechStreamVersion,
    action_id: actionId,
    actor,
    duration_ms: durationMs,
    surface_text: surfaceText,
    technical_increment_max_chars: maxChars,
    ...(start_time_ms > 0 ? { start_time_ms } : {}),
  };
  const streamId =
    `communication_speech_stream_${hashAgentRunValue(streamIdentity).slice(0, 24)}`;

  let consumedUnits = 0;
  const totalUnits = [...surfaceText].length;
  const increments = fragments.map((fragment, index) => {
    const fragmentUnits = [...fragment].length;
    const startUnits = consumedUnits;
    consumedUnits += fragmentUnits;
    const startOffsetMs = durationMs * (startUnits / totalUnits);
    const endOffsetMs = index === fragments.length - 1
      ? durationMs
      : durationMs * (consumedUnits / totalUnits);
    const releaseTimeMs = start_time_ms + endOffsetMs;
    const incrementRef =
      `speech_increment_${hashAgentRunValue({
        version: worldSimulationCommunicationSpeechStreamVersion,
        stream_id: streamId,
        sequence: index + 1,
        surface_fragment: fragment,
        start_offset_ms: startOffsetMs,
        end_offset_ms: endOffsetMs,
        ...(start_time_ms > 0 ? { release_time_ms: releaseTimeMs } : {}),
      }).slice(0, 24)}`;

    return {
      schema_version: worldSimulationCommunicationSpeechStreamVersion,
      stream_id: streamId,
      increment_ref: incrementRef,
      sequence: index + 1,
      start_offset_ms: startOffsetMs,
      end_offset_ms: endOffsetMs,
      ...(start_time_ms > 0 ? { release_time_ms: releaseTimeMs } : {}),
      surface_fragment: fragment,
      signal_phase:
        index === fragments.length - 1 ? "acoustic_segment_ended" : "ongoing",
      technical_segmentation_only: true,
      semantic_content_exposed: false,
      private_purpose_exposed: false,
      listener_audibility_inferred: false,
      listener_understanding_inferred: false,
      floor_claimed: false,
      grounding_claimed: false,
    };
  });

  if (increments.map((item) => item.surface_fragment).join("") !== surfaceText)
    fail("CC-7B technical segmentation failed exact surface reconstruction.");

  return copy({
    schema_version: worldSimulationCommunicationSpeechStreamVersion,
    stream_id: streamId,
    source_action_id: actionId,
    source_actor: actor,
    duration_ms: durationMs,
    ...(start_time_ms > 0 ? { start_time_ms } : {}),
    increment_count: increments.length,
    technical_increment_max_chars: maxChars,
    increments,
    boundaries: {
      source_is_committed_realized_speech: true,
      surface_was_selected_before_stream_schedule: true,
      technical_increment_segmentation_only: true,
      engine_holds_complete_release_schedule: true,
      observer_release_gate_required: true,
      listener_increment_consumption_implemented_here: false,
      segmentation_is_psychological_boundary: false,
      phonetic_boundary_claimed: false,
      prosodic_boundary_claimed: false,
      listener_audibility_inferred: false,
      listener_heard_surface_inferred: false,
      listener_understanding_inferred: false,
      semantic_content_forwarded_in_increment: false,
      private_purpose_forwarded_in_increment: false,
      observer_may_receive_future_increment_before_release: false,
      world_truth_claimed: false,
      grounding_claimed: false,
      floor_arbitrated: false,
      interruption_judged: false,
    },
  });
}

export default projectWorldSimulationCommunicationSpeechStream;
