import { hashAgentRunValue } from "./agent-run-service.mjs";
import { projectWorldSimulationCommunicationSpeechStream } from "./world-simulation-communication-speech-stream-service.mjs";

export const worldSimulationSpeechOverlapVersion =
  "cc7z-world-simultaneous-speech-evidence-v1";

const record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const copy = (value) => JSON.parse(JSON.stringify(value ?? null));

function fail(message) {
  const error = new Error(message);
  error.code = "CC7Z_SPEECH_OVERLAP_INVALID";
  throw error;
}

function ref(kind, value) {
  return `${kind}_${hashAgentRunValue({
    version: worldSimulationSpeechOverlapVersion, value,
  }).slice(0, 24)}`;
}

/**
 * Observe physical simultaneity only. Current CC-7B speech streams start at
 * turn-relative zero; their duration bounds an interval. Neither a pair of
 * overlapping intervals nor their release order says who interrupted whom.
 */
export function buildWorldSimulationSpeechOverlapEvidence({
  action_outcomes = [],
  causal_timeline,
} = {}) {
  if (!Array.isArray(action_outcomes) || action_outcomes.length > 4096 ||
      !record(causal_timeline) || !Array.isArray(causal_timeline.entries) ||
      causal_timeline.entries.length > 65536)
    fail("CC-7Z requires bounded outcomes and authoritative timeline entries.");

  const timeline = causal_timeline.entries;
  const speeches = [];
  const actors = new Set();
  for (const outcome of action_outcomes) {
    if (outcome?.result !== "communication_emitted" ||
        outcome?.communication_event?.channel !== "speech" ||
        !record(outcome.communication_speech_stream))
      continue;
    const stream = outcome.communication_speech_stream;
    const canonical = projectWorldSimulationCommunicationSpeechStream({
      outcome,
      technical_increment_max_chars: stream.technical_increment_max_chars,
    });
    const {source_actor: _privateActor, ...committedStream} = canonical;
    if (JSON.stringify(stream) !== JSON.stringify(committedStream))
      fail("CC-7Z speech stream differs from its emitted source.");
    if (actors.has(outcome.actor))
      fail("CC-7Z cannot assign two concurrent speech actions to one actor.");
    actors.add(outcome.actor);
    for (const increment of stream.increments) {
      const matches = timeline.filter((entry) =>
        entry?.kind === "communication_speech_increment" &&
        entry?.actor === outcome.actor &&
        entry?.action_id === outcome.action_id &&
        entry?.stream_id === stream.stream_id &&
        entry?.increment_ref === increment.increment_ref &&
        entry?.time_ms === increment.end_offset_ms &&
        entry?.surface_fragment === increment.surface_fragment &&
        entry?.signal_phase === increment.signal_phase);
      if (matches.length !== 1)
        fail("CC-7Z speech release has no unique causal timeline entry.");
    }
    speeches.push({
      actor: outcome.actor,
      action_id: outcome.action_id,
      start_ms: 0,
      end_ms: stream.duration_ms,
    });
  }
  if (speeches.length > 64)
    fail("CC-7Z technical pair evidence exceeds its bounded event capacity.");
  speeches.sort((a, b) => a.action_id.localeCompare(b.action_id, "en"));
  const pairs = [];
  for (let i = 0; i < speeches.length; i++) {
    for (let j = i + 1; j < speeches.length; j++) {
      const left = speeches[i];
      const right = speeches[j];
      const start = Math.max(left.start_ms, right.start_ms);
      const end = Math.min(left.end_ms, right.end_ms);
      if (end <= start) continue;
      pairs.push({
        speech_ref_a: ref("speech", {actor:left.actor,action_id:left.action_id}),
        speech_ref_b: ref("speech", {actor:right.actor,action_id:right.action_id}),
        overlap_start_ms: start,
        overlap_end_ms: end,
        interruption_judged: false,
        floor_priority_inferred: false,
      });
    }
  }
  return copy({
    schema_version: worldSimulationSpeechOverlapVersion,
    status: pairs.length ? "simultaneous_realized_speech_observed" :
      "no_simultaneous_realized_speech",
    validated_speech_count: speeches.length,
    overlapping_pair_count: pairs.length,
    pairs,
    boundaries: {
      exact_world_speech_stream_and_timeline_required: true,
      temporal_overlap_only: true,
      technical_stream_segmentation_is_not_turn_boundary: true,
      interruption_judged: false,
      floor_priority_inferred: false,
      listener_audibility_inferred: false,
      listener_understanding_inferred: false,
      backchannel_classified: false,
      grounding_or_belief_changed: false,
      same_turn_action_replanned: false,
    },
  });
}

export default buildWorldSimulationSpeechOverlapEvidence;
