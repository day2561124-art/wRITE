import { hashAgentRunValue } from "./agent-run-service.mjs";
import { runWorldSimulationObserverResponseProposal } from "./world-simulation-observer-response-proposal-service.mjs";
import { prepareWorldSimulationObserverTemporalEpoch } from "./world-simulation-observer-prepared-epoch-service.mjs";
import { worldSimulationObserverSpeechIncrementVersion } from "./world-simulation-communication-observer-increment-service.mjs";

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
  response_proposal, chronological_timeline, observer_admissions = [],
  selected_action_intents = [],
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
  if (!Array.isArray(observer_admissions) || observer_admissions.length > 4096)
    refuse("World scheduling requires bounded authoritative acoustic admissions.");
  const seenAdmissions = new Set();
  for (const item of observed) {
    const cue = item.observer_increment;
    const matches = observer_admissions.filter((admission) =>
      admission?.observer === current.observer
      && admission?.release_time_ms === release
      && admission?.observer_increment?.increment_ref === cue?.increment_ref);
    if (matches.length !== 1 || JSON.stringify(matches[0].observer_increment) !== JSON.stringify(cue)
        || matches[0].admission_status !== "heard_acoustic_cues_only"
        || matches[0].schema_version !== worldSimulationObserverSpeechIncrementVersion)
      refuse("Observer epoch has no unique exact authoritative acoustic admission.");
    const audit = matches[0].audit;
    if (!record(audit) || audit.registered_sound_link_verified !== true
        || audit.static_acoustics_scope_verified !== true
        || audit.source_content_forwarded_to_observer !== false
        || cue.signal_ref !== `observer_signal_${hashAgentRunValue({
          version: worldSimulationObserverSpeechIncrementVersion,
          observer: current.observer, sound_id: audit.source_sound_id,
        }).slice(0, 24)}`)
      refuse("Observer acoustic source audit cannot be verified.");
    const matching = entries.filter((event) =>
      event.kind === "communication_speech_increment"
      && event.stream_id === audit.source_stream_id
      && event.action_id === audit.source_action_id
      && event.actor === audit.source_speaker
      && event.time_ms === release
      && event.result === "speech_increment_released"
      && cue.increment_ref === `observer_increment_${hashAgentRunValue({
        version: worldSimulationObserverSpeechIncrementVersion,
        signal_ref: cue.signal_ref, increment_ref: event.increment_ref,
      }).slice(0, 24)}`
      && cue.perceived_cue_refs?.length === 1
      && cue.perceived_cue_refs[0] === `audible_cue_${hashAgentRunValue({
        version: worldSimulationObserverSpeechIncrementVersion,
        signal_ref: cue.signal_ref, increment_ref: event.increment_ref,
      }).slice(0, 24)}`);
    if (matching.length !== 1 || matching[0].actor === current.observer
        || matching[0].action_id === expected.selected_candidate.action_id)
      refuse("Observer epoch has no matching earlier released World speech increment.");
    if (seenAdmissions.has(cue.increment_ref))
      refuse("One observer acoustic increment cannot be consumed twice.");
    seenAdmissions.add(cue.increment_ref);
    const entry = matching[0];
    const selectedSpeech = selected_action_intents.some((selection) =>
      selection?.character === entry.actor
      && selection?.candidate?.action_id === entry.action_id
      && selection?.candidate?.communication?.channel === "speech");
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
