import { hashAgentRunValue } from "./agent-run-service.mjs";
import { runWorldSimulationObserverResponseProposal } from "./world-simulation-observer-response-proposal-service.mjs";
import { prepareWorldSimulationObserverTemporalEpoch } from "./world-simulation-observer-prepared-epoch-service.mjs";

export const worldSimulationNativeTemporalScheduleVersion =
  "cc7ad-world-owned-temporal-schedule-v1";

const record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const copy = (value) => JSON.parse(JSON.stringify(value ?? null));

function refuse(message) {
  const error = new Error(message);
  error.code = "CC7AD_WORLD_TEMPORAL_SCHEDULE_INVALID";
  throw error;
}

/**
 * Engine-private World scheduler boundary. It does NOT grant the character
 * permission to write World truth. The schedule is deliberately inert until
 * a later native World causal re-adjudication uses the exact time anchor.
 */
export function buildWorldSimulationNativeTemporalScheduleContract() {
  return {
    version: worldSimulationNativeTemporalScheduleVersion,
    owner: "programmatic_world_native_turn",
    same_turn_release_time_anchor_required: true,
    current_observer_epoch_revalidated: true,
    same_character_proposal_recomputed: true,
    source_speech_increment_verified_in_world_timeline: true,
    same_timestamp_world_batch_not_split: true,
    response_time_never_precedes_observer_release: true,
    replay_from_original_pre_turn_state_required: true,
    stale_epoch_must_be_reprepared_after_causal_change: true,
    selected_candidate_is_not_emitted_signal: true,
    proposal_does_not_award_floor: true,
    causal_recomputation_performed_here: false,
    world_mutation_performed_here: false,
  };
}

export async function scheduleWorldSimulationNativeTemporalResponse({
  epoch_context, presented_epoch, character_input, character_input_binding,
  response_proposal, chronological_timeline, selected_action_intents = [],
  selection_resolver, consumed_epoch_ids = [],
} = {}) {
  const current = prepareWorldSimulationObserverTemporalEpoch(epoch_context);
  if (!current || !record(presented_epoch)
      || JSON.stringify(current) !== JSON.stringify(presented_epoch))
    refuse("World scheduling requires the exact current observer epoch.");
  if (!record(response_proposal) || response_proposal.epoch_id !== current.epoch_id)
    refuse("World scheduling refuses a stale or missing response proposal.");
  const expected = await runWorldSimulationObserverResponseProposal({
    epoch_context, presented_epoch, character_input, character_input_binding,
    selection_resolver, consumed_epoch_ids,
  });
  if (JSON.stringify(expected) !== JSON.stringify(response_proposal))
    refuse("World scheduling requires the exact recomputed same-character proposal.");
  if (expected.proposal_status === "rejected_all")
    return copy({
      schema_version: worldSimulationNativeTemporalScheduleVersion,
      schedule_status: "no_response",
      epoch_id: current.epoch_id,
      consumed_epoch_ids: expected.consumed_epoch_ids,
      scheduled_response: null,
      boundaries: buildWorldSimulationNativeTemporalScheduleContract(),
    });
  if (expected.proposal_status !== "selected_for_future_causal_resolution"
      || !record(expected.selected_candidate))
    refuse("Only the current selected same-character candidate can be scheduled.");
  const entries = chronological_timeline?.entries;
  const release = current.release_time_ms;
  if (!Array.isArray(entries) || !Number.isFinite(release) || release < 0
      || chronological_timeline.timeline_hash !== hashAgentRunValue(
        Object.fromEntries(Object.entries(chronological_timeline).filter(([key]) => key !== "timeline_hash")),
      ))
    refuse("World scheduling requires the exact hashed authoritative timeline.");
  const cues = current.observer_view?.heard_nonlexical;
  if (!Array.isArray(cues) || cues.length === 0)
    refuse("World scheduling requires an actually admitted observer increment.");
  // A cue is bound to its World release, not to the listener's guess about
  // the speaker, intelligibility, intent, or the current world snapshot.
  const admissions = epoch_context?.ledger?.ticks?.[current.release_cursor]?.observer_cues;
  const observed = (Array.isArray(admissions) ? admissions : []).filter(
    (item) => item?.observer === current.observer);
  if (observed.length !== cues.length)
    refuse("Observer release and World admission counts disagree.");
  for (const item of observed) {
    const cue = item.observer_increment;
    const entry = entries.find((event) =>
      event.kind === "communication_speech_increment"
      && event.increment_ref === cue?.increment_ref
      && event.time_ms === release
      && event.result === "speech_increment_released");
    if (!entry || entry.action_id === expected.selected_candidate.action_id
        || entry.actor === current.observer)
      refuse("Observer epoch has no matching earlier released World speech increment.");
    const selectedSpeech = selected_action_intents.some((selection) =>
      selection?.character === entry.actor
      && selection?.candidate?.action_id === entry.action_id);
    if (!selectedSpeech)
      refuse("Observer source speech must belong to an actually selected World action.");
  }
  const schedule = {
    schema_version: worldSimulationNativeTemporalScheduleVersion,
    schedule_id: "world_temporal_response_" + hashAgentRunValue({
      epoch_id: current.epoch_id,
      proposal_id: expected.proposal_id,
      timeline_hash: chronological_timeline.timeline_hash,
      release_time_ms: release,
    }).slice(0, 32),
    epoch_id: current.epoch_id,
    proposal_id: expected.proposal_id,
    actor: current.observer,
    action_id: expected.selected_candidate.action_id,
    release_time_ms: release,
    earliest_start_time_ms: release,
    source_timeline_hash: chronological_timeline.timeline_hash,
    source_prefix_hash: current.source_prefix_hash,
    replay_policy: "must_recompute_world_causality_from_original_pre_turn_state",
    emission_status: "not_emitted",
    floor_awarded: false,
  };
  return copy({
    schema_version: worldSimulationNativeTemporalScheduleVersion,
    schedule_status: "awaiting_world_causal_recomputation",
    epoch_id: current.epoch_id,
    consumed_epoch_ids: expected.consumed_epoch_ids,
    scheduled_response: schedule,
    boundaries: buildWorldSimulationNativeTemporalScheduleContract(),
  });
}
