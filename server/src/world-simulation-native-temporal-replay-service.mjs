import { hashAgentRunValue } from "./agent-run-service.mjs";
import { adjudicateWorldSimulationCausality } from "./world-simulation-causal-rule-engine.mjs";
import { buildWorldSimulationObserverMicrotickLedger } from "./world-simulation-observer-microtick-ledger-service.mjs";
import { buildWorldSimulationObserverTickSnapshotReadiness } from "./world-simulation-observer-tick-snapshot-readiness-service.mjs";
import { reconstructWorldSimulationObserverTickPrefixes } from "./world-simulation-observer-tick-prefix-reconstruction-service.mjs";
import { prepareWorldSimulationObserverTemporalEpoch } from "./world-simulation-observer-prepared-epoch-service.mjs";
import { runWorldSimulationObserverResponseProposal } from "./world-simulation-observer-response-proposal-service.mjs";
import { scheduleWorldSimulationNativeTemporalResponse } from "./world-simulation-native-temporal-schedule-service.mjs";
import { assertWorldSimulationSubjectiveChoiceCommitmentReceiptBundle } from "./world-simulation-subjective-choice-commitment-receipt-service.mjs";

export const worldSimulationNativeTemporalReplayVersion =
  "cc7ad-world-owned-native-causal-replay-v1";

const record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const clone = (value) => JSON.parse(JSON.stringify(value ?? null));

function refuse(message) {
  const error = new Error(message);
  error.code = "CC7AD_WORLD_NATIVE_REPLAY_INVALID";
  throw error;
}

export function buildWorldSimulationNativeTemporalReplayContract() {
  return {
    version: worldSimulationNativeTemporalReplayVersion,
    owner: "programmatic_world_native_turn",
    causal_solver: "canonical_programmatic_adjudicator_only",
    source_is_original_pre_turn_snapshot: true,
    observer_must_have_rejected_initial_action: true,
    initial_and_post_cue_selections_are_distinct_causal_stages: true,
    original_phase74d_receipt_must_never_be_silently_rewritten: true,
    acoustic_source_requires_authoritative_reconstructed_epoch: true,
    at_most_one_response_per_turn: true,
    replay_pre_release_world_prefix_must_be_unchanged: true,
    replay_pre_release_speech_lineage_must_be_unchanged: true,
    source_action_must_still_emit: true,
    response_must_emit_at_scheduled_time: true,
    cognition_forwarded_from_world_to_other_character: false,
    world_commit_performed_here: false,
    existing_atomic_commit_required: true,
  };
}

function canonicalInput({
  session_id, turn_id, world_state, world_state_revision, world_state_hash,
  event, scene_analysis, selected_action_intents,
}) {
  return {
    world_simulation_session_id: session_id, turn_id,
    world_state: clone(world_state),
    world_state_revision, world_state_hash,
    event: clone(event), scene_analysis: clone(scene_analysis),
    selected_action_intents: clone(selected_action_intents),
  };
}

function earlierEvents(resolution, releaseTime) {
  return (resolution.causal_timeline?.entries ?? [])
    .filter((entry) => entry.time_ms <= releaseTime)
    .map(({sequence: _sequence, ...entry}) => entry);
}

function earlierMutationBatches(resolution, releaseTime) {
  return (resolution.chronological_mutation_queue?.batches ?? [])
    .filter((batch) => batch.time_ms <= releaseTime)
    .map((batch) => clone(batch));
}

/**
 * Inert, engine-private dry run of ONE optional same-turn response.
 * The native turn must complete this BEFORE subjective-choice receipts and
 * must submit the returned selected intents and resolution to its usual
 * consistency/atomic-commit gates. Nothing here commits or sends Brain views
 * to other observers.
 */
export async function replayWorldSimulationNativeTemporalResponse({
  session_id, turn_id, world_state, world_state_revision, world_state_hash,
  event, scene_analysis, selected_action_intents, observer,
  character_input, selection_resolver,
} = {}) {
  if (!record(world_state) || hashAgentRunValue(world_state) !== world_state_hash
      || !Array.isArray(selected_action_intents)
      || selected_action_intents.length > 128
      || typeof observer !== "string" || !observer
      || !record(character_input) || character_input.character !== observer
      || !record(character_input.cognition)
      || typeof selection_resolver !== "function")
    refuse("World replay requires exact original snapshot and one same-character Brain resolver.");
  if (selected_action_intents.filter((item) => item?.character === observer).length !== 1
      || !selected_action_intents.some((item) =>
        item?.character === observer && item?.selection === "reject_all"
        && item?.candidate === null && item?.action_id === null))
    refuse("Observer may respond only after rejecting its initial selected action.");

  const input = canonicalInput({
    session_id, turn_id, world_state, world_state_revision, world_state_hash,
    event, scene_analysis, selected_action_intents,
  });
  const initial = await adjudicateWorldSimulationCausality(input);
  const ledger = buildWorldSimulationObserverMicrotickLedger({
    causal_timeline: initial.causal_timeline,
    admissions: initial.communication_observer_increment_admissions,
  });
  if (ledger.tick_count === 0)
    return {
      status: "no_admitted_cue", selected_action_intents: clone(selected_action_intents),
      causal_resolution: initial, native_temporal_response: null,
      boundaries: buildWorldSimulationNativeTemporalReplayContract(),
    };
  const readiness = buildWorldSimulationObserverTickSnapshotReadiness({
    ledger, chronological_mutation_queue: initial.chronological_mutation_queue,
    chronological_mutation_execution: initial.chronological_mutation_execution,
  });
  const reconstruction = reconstructWorldSimulationObserverTickPrefixes({
    pre_turn_world_state: world_state,
    authoritative_next_world_state: initial.next_world_state,
    ledger, readiness,
    chronological_mutation_queue: initial.chronological_mutation_queue,
    chronological_mutation_execution: initial.chronological_mutation_execution,
    scene_id: event?.scene_id ?? event?.location_id ?? null,
  });
  if (reconstruction.audit.status !== "engine_private_prefixes_reconstructed")
    return {
      status: "unsafe_prefix", selected_action_intents: clone(selected_action_intents),
      causal_resolution: initial, native_temporal_response: null,
      refusal_reason: reconstruction.audit.reason ?? readiness.status,
      boundaries: buildWorldSimulationNativeTemporalReplayContract(),
    };
  const cursor = ledger.ticks.findIndex((tick) =>
    tick.observer_cues.some((cue) => cue.observer === observer));
  if (cursor < 0)
    return {
      status: "no_admitted_cue", selected_action_intents: clone(selected_action_intents),
      causal_resolution: initial, native_temporal_response: null,
      boundaries: buildWorldSimulationNativeTemporalReplayContract(),
    };
  if (ledger.tick_count > 32)
    refuse("Native response cannot bypass bounded verified snapshot budget.");
  const context = {
    session_id, turn_id, world_state_revision,
    pre_turn_world_state: clone(world_state),
    ledger, reconstruction, scene_id: event?.scene_id ?? event?.location_id ?? null,
    observer, cursor,
  };
  const epoch = prepareWorldSimulationObserverTemporalEpoch(context);
  if (!epoch) refuse("Admitted observer cue has no canonical prepared epoch.");
  const binding = {
    session_id, turn_id, world_state_revision,
    epoch_id: epoch.epoch_id,
    source_prefix_hash: epoch.source_prefix_hash,
    character_input_hash: hashAgentRunValue(character_input),
  };
  const proposed = await runWorldSimulationObserverResponseProposal({
    epoch_context: context, presented_epoch: epoch,
    character_input, character_input_binding: binding, selection_resolver,
  });
  const scheduled = await scheduleWorldSimulationNativeTemporalResponse({
    epoch_context: context, presented_epoch: epoch,
    character_input, character_input_binding: binding,
    response_proposal: proposed,
    chronological_timeline: initial.causal_timeline,
    observer_admissions: initial.communication_observer_increment_admissions,
    selected_action_intents, selection_resolver,
  });
  if (scheduled.schedule_status === "no_response")
    return {
      status: "rejected_all", selected_action_intents: clone(selected_action_intents),
      causal_resolution: initial, native_temporal_response: null,
      boundaries: buildWorldSimulationNativeTemporalReplayContract(),
    };
  const anchor = scheduled.scheduled_response;
  if (anchor.actor !== observer
      || anchor.action_id !== proposed.selected_candidate?.action_id
      || anchor.source_prefix_hash !== epoch.source_prefix_hash)
    refuse("Fresh schedule and selected proposal differ.");
  const replayedSelected = selected_action_intents.map((item) =>
    item.character !== observer ? clone(item) : {
      character: observer, selection: "candidate_action_intent",
      action_id: anchor.action_id,
      intent: proposed.selected_candidate.intent ?? null,
      candidate: clone(proposed.selected_candidate),
    });
  const replay = await adjudicateWorldSimulationCausality({
    ...canonicalInput({
      session_id, turn_id, world_state, world_state_revision, world_state_hash,
      event, scene_analysis, selected_action_intents: replayedSelected,
    }),
    native_temporal_response: {
      actor: observer, action_id: anchor.action_id,
      start_time_ms: anchor.earliest_start_time_ms,
    },
  });
  const releaseTime = anchor.release_time_ms;
  if (JSON.stringify(earlierEvents(initial, releaseTime))
      !== JSON.stringify(earlierEvents(replay, releaseTime))
      || JSON.stringify(earlierMutationBatches(initial, releaseTime))
      !== JSON.stringify(earlierMutationBatches(replay, releaseTime)))
    refuse("Native replay changed the World timeline or mutation prefix before the response.");
  const sourceRefs = new Set(ledger.ticks[cursor].observer_cues
    .filter((item) => item.observer === observer)
    .map((item) => item.observer_increment.increment_ref));
  const replayAdmissions = replay.communication_observer_increment_admissions
    .filter((item) => item.observer === observer
      && item.release_time_ms === releaseTime
      && item.admission_status === "heard_acoustic_cues_only");
  if (!replayAdmissions.some((item) =>
    sourceRefs.has(item.observer_increment?.increment_ref)))
    refuse("Replayed World no longer exposes the source actually heard by the observer.");
  const result = replay.action_outcomes.filter((outcome) =>
    outcome.actor === observer && outcome.action_id === anchor.action_id
    && outcome.result === "communication_emitted"
    && outcome.communication_event?.channel === "speech"
    && outcome.start_time_ms === anchor.earliest_start_time_ms);
  if (result.length !== 1)
    refuse("Scheduled response did not emit at its World-owned time anchor.");
  const emitted = result[0];
  if (!replay.causal_timeline.entries.some((entry) =>
    entry.kind === "communication_speech_increment"
    && entry.action_id === anchor.action_id
    && entry.time_ms > releaseTime))
    refuse("Scheduled response has no later, actual public release.");
  const audit = {
    schema_version: worldSimulationNativeTemporalReplayVersion,
    schedule_id: anchor.schedule_id,
    source_epoch_id: anchor.epoch_id,
    source_proposal_id: anchor.proposal_id,
    source_pre_turn_state_hash: world_state_hash,
    session_id, turn_id, world_state_revision,
    source_initial_selection_hash: hashAgentRunValue(selected_action_intents),
    initial_selection_kind: "reject_all",
    post_cue_selection_kind: "candidate_action_intent",
    actor: observer, action_id: anchor.action_id,
    start_time_ms: anchor.earliest_start_time_ms,
    source_timeline_hash: anchor.source_timeline_hash,
    source_prefix_hash: anchor.source_prefix_hash,
    causal_resolution_id: replay.causal_resolution_id,
    response_emitted: true, world_committed: false,
    private_cognition_persisted: false,
  };
  return {
    status: "replayed_same_turn", selected_action_intents: replayedSelected,
    initial_selected_action_intents: clone(selected_action_intents),
    causal_resolution: replay,
    native_temporal_response: {
      ...audit,
      audit_hash: hashAgentRunValue(audit),
    },
    boundaries: buildWorldSimulationNativeTemporalReplayContract(),
  };
}

/**
 * Post-cue response is a NEW character choice, not a retroactive rewrite of
 * Phase74D's pre-cue reject_all. The World may persist this evidence only
 * with the eventual atomic turn commit, alongside the unmodified Phase74D
 * bundle. It is not a fabricated Phase74A/B/C deliberation receipt.
 */
export function reconcileWorldSimulationNativeTemporalChoiceLineage({
  original_receipts, native_replay,
} = {}) {
  const receipts = assertWorldSimulationSubjectiveChoiceCommitmentReceiptBundle(
    original_receipts,
  );
  const replay = native_replay;
  const response = replay?.native_temporal_response;
  if (replay?.status !== "replayed_same_turn"
      || !record(response)
      || response.schema_version !== worldSimulationNativeTemporalReplayVersion
      || response.audit_hash !== hashAgentRunValue(Object.fromEntries(
        Object.entries(response).filter(([key]) => key !== "audit_hash")))
      || !Array.isArray(replay.initial_selected_action_intents)
      || !Array.isArray(replay.selected_action_intents)
      || response.source_initial_selection_hash
        !== hashAgentRunValue(replay.initial_selected_action_intents)
      || response.source_pre_turn_state_hash !== receipts.world_state_hash
      || response.session_id !== receipts.world_simulation_session_id
      || response.turn_id !== receipts.turn_id
      || response.world_state_revision !== receipts.state_revision)
    refuse("Post-cue choice lineage requires exact independently revalidated native replay.");
  const initial = replay.initial_selected_action_intents.filter((selected) =>
    selected.character === response.actor);
  const final = replay.selected_action_intents.filter((selected) =>
    selected.character === response.actor);
  const originalReceipt = receipts.receipts.filter((receipt) =>
    receipt.character === response.actor);
  if (originalReceipt.length !== 1 || initial.length !== 1 || final.length !== 1
      || originalReceipt[0].selection_kind !== "reject_all"
      || originalReceipt[0].action_id !== null
      || initial[0].selection !== "reject_all"
      || initial[0].candidate !== null
      || final[0].selection !== "candidate_action_intent"
      || final[0].action_id !== response.action_id
      || final[0].candidate?.action_id !== response.action_id
      || JSON.stringify(replay.initial_selected_action_intents.filter((item) =>
        item.character !== response.actor)) !== JSON.stringify(
        replay.selected_action_intents.filter((item) =>
          item.character !== response.actor)))
    refuse("Post-cue choice must preserve the original pre-cue rejection and exact response.");
  const evidence = {
    schema_version: "cc7ad-native-temporal-choice-stage-evidence-v1",
    source_original_receipt_id: originalReceipt[0].receipt_id,
    source_original_receipt_bundle_hash: receipts.receipt_bundle_hash,
    source_native_replay_audit_hash: response.audit_hash,
    character: response.actor,
    initial_selection_kind: "reject_all",
    initial_selection_scope: "pre_observer_cue_only",
    response_selection_kind: "candidate_action_intent",
    response_action_id: response.action_id,
    response_release_time_ms: response.start_time_ms,
    original_phase74d_receipt_unchanged: true,
    post_cue_phase74a_b_c_lineage_fabricated: false,
    world_committed: false,
    persist_only_with_atomic_world_commit: true,
  };
  return {
    ...evidence,
    evidence_hash: hashAgentRunValue(evidence),
  };
}
