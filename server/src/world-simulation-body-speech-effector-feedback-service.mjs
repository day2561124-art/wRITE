import { getWorldSimulationHistory, getWorldSimulationState } from "./world-simulation-state-service.mjs";

export const worldSimulationBodySpeechEffectorFeedbackVersion =
  "body-1j-committed-speech-effector-feedback-v1";

function record(value) { return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }
function list(value) { return Array.isArray(value) ? value : []; }
function fail(code) { const error = new Error(code); error.code = code; throw error; }
function name(value) { return typeof value === "string" ? value.trim() : ""; }

// World emission, the temporal speech stream and an acoustic sound source are
// separate outcomes. A selected speech intention alone proves none of them.
export function projectWorldSimulationBodySpeechEffectorFeedback({
  world_history, character, world_state_revision,
} = {}) {
  const actor = name(character);
  if (!actor) fail("BODY1J_CHARACTER_REQUIRED");
  if (!Number.isSafeInteger(world_state_revision) || world_state_revision < 0)
    fail("BODY1J_REVISION_REQUIRED");
  const turn = record(list(record(world_history).turns).at(-1));
  if (world_state_revision > 0 && turn.revision_to !== world_state_revision)
    fail("BODY1J_HISTORY_REVISION_MISMATCH");
  const feedback = [];
  if (turn.revision_to === world_state_revision) {
    for (const selected of list(turn.selected_action_intents)) {
      if (selected?.character !== actor || selected.selection === "reject_all") continue;
      const candidate = record(selected.candidate);
      const actionId = name(candidate.action_id);
      if (record(candidate.communication).channel !== "speech"
          || !actionId || selected.action_id !== actionId) continue;
      const outcomes = list(turn.action_outcomes).filter((item) =>
        item?.actor === actor && item.action_id === actionId);
      if (outcomes.length > 1) fail("BODY1J_AMBIGUOUS_ACTION_OUTCOME");
      const outcome = record(outcomes[0]);
      const event = record(outcome.communication_event);
      const emitted = outcome.result === "communication_emitted"
        && event.actor === actor && event.channel === "speech"
        && event.surface_realization_complete === true
        && record(event.surface_realization).source_action_id === actionId;
      const stream = record(outcome.communication_speech_stream);
      const acoustic = record(outcome.communication_acoustic_signal);
      feedback.push(Object.freeze({
        action_id: actionId,
        status: emitted ? "speech_emitted" : outcomes.length ? "speech_not_emitted" : "emission_unconfirmed",
        temporal_stream_registered: emitted && stream.source_action_id === actionId
          && Array.isArray(stream.increments),
        physical_sound_registered: emitted && acoustic.registered === true
          && acoustic.source_action_id === actionId && Boolean(name(acoustic.sound_id)),
        source_world_revision: world_state_revision,
      }));
    }
  }
  return Object.freeze({
    version: worldSimulationBodySpeechEffectorFeedbackVersion,
    authority: "committed_world_speech_outcome",
    character: actor,
    source_world_revision: world_state_revision,
    feedback: Object.freeze(feedback.slice(-16)),
    boundaries: Object.freeze({
      selection_is_not_emission: true,
      emission_is_not_acoustic_registration: true,
      acoustic_registration_is_not_listener_audibility: true,
      surface_text_exposed: false,
      semantic_content_exposed: false,
      respiratory_capacity_inferred: false,
      subjective_belief_asserted: false,
    }),
  });
}

export async function readCommittedWorldSimulationBodySpeechEffectorFeedback({
  session_id, character, expected_revision, expected_state_hash,
} = {}, options = {}) {
  const first = await getWorldSimulationState(session_id, options);
  if (expected_revision !== undefined && first.revision !== expected_revision)
    fail("BODY1J_STATE_REVISION_CHANGED");
  if (expected_state_hash !== undefined && first.state_hash !== expected_state_hash)
    fail("BODY1J_STATE_HASH_CHANGED");
  if (!Object.hasOwn(record(first.state?.characters), name(character)))
    fail("BODY1J_CHARACTER_NOT_IN_COMMITTED_WORLD");
  const history = await getWorldSimulationHistory(session_id, options);
  const second = await getWorldSimulationState(session_id, options);
  if (first.revision !== second.revision || first.state_hash !== second.state_hash)
    fail("BODY1J_COMMITTED_SNAPSHOT_CHANGED");
  const last = list(history.turns).at(-1);
  if (first.revision === 0 ? Boolean(last)
    : last?.revision_to !== first.revision || last?.next_state_hash !== first.state_hash)
    fail("BODY1J_HISTORY_STATE_MISMATCH");
  return Object.freeze({
    ...projectWorldSimulationBodySpeechEffectorFeedback({
      world_history: history, character, world_state_revision: first.revision,
    }),
    world_state_hash: first.state_hash,
  });
}

export function buildWorldSimulationBodySpeechEffectorFeedbackContract() {
  return Object.freeze({
    version: worldSimulationBodySpeechEffectorFeedbackVersion,
    source: "committed_world_speech_outcome",
    read_only: true,
    selected_speech_is_not_emitted_speech: true,
    emitted_speech_is_not_acoustic_registration: true,
    acoustic_registration_is_not_listener_hearing: true,
    respiratory_physiology_inferred: false,
  });
}
