import { hashAgentRunValue } from "./agent-run-service.mjs";
import { adjudicateWorldSimulationCausality } from "./world-simulation-causal-rule-engine.mjs";
import { buildWorldSimulationObserverMicrotickLedger } from "./world-simulation-observer-microtick-ledger-service.mjs";
import { buildWorldSimulationObserverTickSnapshotReadiness } from "./world-simulation-observer-tick-snapshot-readiness-service.mjs";
import { reconstructWorldSimulationObserverTickPrefixes } from "./world-simulation-observer-tick-prefix-reconstruction-service.mjs";
import { prepareWorldSimulationObserverTemporalEpoch } from "./world-simulation-observer-prepared-epoch-service.mjs";
import { runWorldSimulationObserverResponseProposal } from "./world-simulation-observer-response-proposal-service.mjs";
import { scheduleWorldSimulationNativeTemporalResponse } from "./world-simulation-native-temporal-schedule-service.mjs";
import { stepWorldSimulationNativeResponsePreparation } from "./world-simulation-native-response-preparation-service.mjs";
import { assessWorldSimulationNativeCausalEpochSupersession } from "./world-simulation-native-causal-epoch-invalidation-service.mjs";
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
    // The response starts in the release-time batch; its final clock/queue
    // mutation may legitimately re-coalesce that SAME timestamp. Earlier
    // completed batches must be byte-for-byte unchanged.
    .filter((batch) => batch.time_ms < releaseTime)
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
  character_input, character_input_resolver, selection_resolver,
  preparation_decision_resolver, causal_epoch_revalidation_resolver,
} = {}) {
  if (!record(world_state) || hashAgentRunValue(world_state) !== world_state_hash
      || !Array.isArray(selected_action_intents)
      || selected_action_intents.length > 128
      || typeof observer !== "string" || !observer
      || (typeof character_input_resolver !== "function"
        && (!record(character_input) || character_input.character !== observer
          || !record(character_input.cognition)))
      || typeof selection_resolver !== "function"
      || (preparation_decision_resolver !== undefined
        && typeof preparation_decision_resolver !== "function")
      || (causal_epoch_revalidation_resolver !== undefined
        && typeof causal_epoch_revalidation_resolver !== "function"))
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
  if (ledger.tick_count > 32)
    refuse("Native response cannot bypass bounded verified snapshot budget.");
  // The legacy CC-7AD path still selects at the first actual admitted cue.
  // Opt-in CC-7AE may wait/revise privately, but every later decision is
  // attached to a new, World-reconstructed observer epoch; skipped ticks
  // may never contain a cue for this observer.
  let cursor = -1;
  let context = null;
  let epoch = null;
  let preparation = null;
  const preparationAudits = [];
  for (let i = 0; i < ledger.ticks.length; i += 1) {
    if (!ledger.ticks[i].observer_cues.some((cue) => cue.observer === observer))
      continue;
    const nextContext = {
      session_id, turn_id, world_state_revision,
      pre_turn_world_state: clone(world_state),
      ledger, reconstruction, scene_id: event?.scene_id ?? event?.location_id ?? null,
      observer, cursor: i,
    };
    const nextEpoch = prepareWorldSimulationObserverTemporalEpoch({
      ...nextContext,
      previous_epoch: preparation?.engine_private_last_epoch ?? null,
    });
    if (!nextEpoch)
      refuse("Admitted observer cue has no canonical prepared epoch.");
    if (preparation_decision_resolver) {
      const answer = await preparation_decision_resolver(clone({
        schema_version: "cc7ae-native-preparation-decision-view-v1",
        character: observer,
        epoch_id: nextEpoch.epoch_id,
        release_time_ms: nextEpoch.release_time_ms,
        observer_view: nextEpoch.observer_view,
        previous_preparation_audit_hash: preparation?.audit.audit_hash ?? null,
        boundaries: {
          only_current_released_cue: true,
          no_world_snapshot: true,
          no_other_observer: true,
          no_future_cue: true,
          no_public_signal_from_wait_or_revision: true,
          no_fixed_response_latency: true,
        },
      }));
      if (!record(answer)
          || Object.keys(answer).sort().join("|") !== "decision|epoch_id"
          || answer.epoch_id !== nextEpoch.epoch_id
          || !["wait", "revise_preparation", "select_response"].includes(answer.decision))
        refuse("Native preparation decision must bind the exact current observer epoch.");
      if (answer.decision !== "select_response") {
        preparation = stepWorldSimulationNativeResponsePreparation({
          epoch_context: nextContext, presented_epoch: nextEpoch,
          decision: answer.decision, previous: preparation,
        });
        preparationAudits.push(clone(preparation.audit));
        continue;
      }
    }
    cursor = i;
    // CC-7AC and the CC-7AD scheduler independently re-prepare the epoch;
    // both MUST see the last consumed private epoch. Otherwise the later
    // cue would appear to skip an earlier actually admitted release.
    context = {
      ...nextContext,
      ...(preparation ? {
        previous_epoch: preparation.engine_private_last_epoch,
      } : {}),
    };
    epoch = nextEpoch;
    break;
  }
  if (cursor < 0)
    return {
      status: preparation ? "awaiting_later_cue" : "no_admitted_cue",
      selected_action_intents: clone(selected_action_intents),
      causal_resolution: initial, native_temporal_response: null,
      ...(preparation ? {
        preparation_audit: clone(preparation.audit),
        preparation_audits: clone(preparationAudits),
      } : {}),
      boundaries: buildWorldSimulationNativeTemporalReplayContract(),
    };
  // CC-7AF optional engine-only challenge: re-adjudicate BOTH source
  // action sets from the same verified pre-turn World state. A changed
  // execution must invalidate this epoch, not silently adopt a new
  // character's action or use the old observer preparation as permission.
  // Never pass the revised World selection or execution to Character Brain.
  const fence = async (stage) => {
    if (!causal_epoch_revalidation_resolver) return;
    const view = clone({
      schema_version: "cc7af-engine-only-causal-revalidation-v1",
      stage, observer, session_id, turn_id,
      source_epoch_id: epoch.epoch_id,
      source_execution_hash: epoch.causal_epoch_hash,
      source_ledger_hash: epoch.ledger_hash,
      source_pre_turn_state_hash: world_state_hash,
      original_selected_action_intents_hash:
        hashAgentRunValue(selected_action_intents),
      source_release_time_ms: epoch.release_time_ms,
      boundaries: {
        engine_only_not_character_view: true,
        refusal_only_never_authorizes_replacement_action: true,
        cannot_retract_committed_sound: true,
        canonical_world_re_adjudication_required: true,
      },
    });
    const answer = await causal_epoch_revalidation_resolver(view);
    if (!record(answer)
        || Object.keys(answer).sort().join("|")
          !== "revised_selected_action_intents|source_epoch_id"
        || answer.source_epoch_id !== epoch.epoch_id
        || !Array.isArray(answer.revised_selected_action_intents))
      refuse("CC-7AF World revalidation challenge must bind the exact current epoch.");
    const assessment = await assessWorldSimulationNativeCausalEpochSupersession({
      session_id, turn_id, world_state, world_state_revision,
      world_state_hash, event, scene_analysis,
      original_selected_action_intents: selected_action_intents,
      revised_selected_action_intents: answer.revised_selected_action_intents,
      observer, original_release_cursor: cursor,
      expected_original_execution_hash: epoch.causal_epoch_hash,
      expected_original_ledger_hash: epoch.ledger_hash,
    });
    if (assessment.status !== "unchanged_epoch"
        || assessment.obsolete_preparation_must_not_authorize_new_action)
      refuse("CC-7AF native response invalidated by a superseded source causal epoch.");
  };
  await fence("before_fresh_character_input");
  const freshInput = typeof character_input_resolver === "function"
    ? await character_input_resolver(clone({
      character: observer,
      observer_view: epoch.observer_view,
      boundaries: {
        same_character_only: true, no_world_truth_exposed: true,
        no_future_cues_exposed: true,
        private_observer_response_only: true,
      },
    })) : character_input;
  if (!record(freshInput) || freshInput.character !== observer
      || !record(freshInput.cognition))
    refuse("Native observer response requires fresh same-character cognition.");
  const binding = {
    session_id, turn_id, world_state_revision,
    epoch_id: epoch.epoch_id,
    source_prefix_hash: epoch.source_prefix_hash,
    character_input_hash: hashAgentRunValue(freshInput),
  };
  const proposed = await runWorldSimulationObserverResponseProposal({
    epoch_context: context, presented_epoch: epoch,
    character_input: freshInput, character_input_binding: binding, selection_resolver,
    consumed_epoch_ids: preparation?.engine_private_consumed_epoch_ids ?? [],
  });
  const scheduled = await scheduleWorldSimulationNativeTemporalResponse({
    epoch_context: context, presented_epoch: epoch,
    character_input: freshInput, character_input_binding: binding,
    response_proposal: proposed,
    chronological_timeline: initial.causal_timeline,
    observer_admissions: initial.communication_observer_increment_admissions,
    selected_action_intents,
    consumed_epoch_ids: preparation?.engine_private_consumed_epoch_ids ?? [],
    // CC-7AD revalidates the exact proposal without a second Character Brain
    // decision. Reinvoking a nondeterministic Brain would create a new choice
    // rather than verify the decision made at this observer release.
    selection_resolver: async (view) => proposed.proposal_status === "rejected_all"
      ? { epoch_id: view.epoch_id, reject_all: true }
      : { epoch_id: view.epoch_id, action_id: proposed.selected_candidate.action_id },
  });
  if (scheduled.schedule_status === "no_response")
    return {
      status: "rejected_all", selected_action_intents: clone(selected_action_intents),
      causal_resolution: initial, native_temporal_response: null,
      boundaries: buildWorldSimulationNativeTemporalReplayContract(),
    };
  // A source can be superseded after the character tentatively selects a
  // response, too. This second fence fails the whole speculative turn:
  // neither the old proposal nor its scheduled signal may be committed.
  await fence("after_tentative_selection_before_world_replay");
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
    refuse("Native replay changed the World timeline or completed mutation prefix before the response.");
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
    ...(preparation ? {
      source_preparation_audit_hash: preparation.audit.audit_hash,
      source_preparation_consumed_count: preparation.audit.consumed_count,
    } : {}),
  };
  return {
    status: "replayed_same_turn", selected_action_intents: replayedSelected,
    initial_selected_action_intents: clone(selected_action_intents),
    causal_resolution: replay,
    ...(preparation ? {
      preparation_audit: clone(preparation.audit),
      preparation_audits: clone(preparationAudits),
    } : {}),
    native_temporal_response: {
      ...audit,
      audit_hash: hashAgentRunValue(audit),
    },
    boundaries: buildWorldSimulationNativeTemporalReplayContract(),
  };
}

/**
 * Atomic-commit admission: the compact post-cue choice evidence must remain
 * tied to the actual original Phase74D receipt AND the finalized emitted
 * speech. The Engine may not persist a caller-authored or stale choice claim.
 */
export function assertWorldSimulationNativeTemporalChoiceEvidence({
  evidence, original_receipts, selected_action_intents,
  action_outcomes, causal_timeline,
} = {}) {
  if (evidence === null || evidence === undefined) return null;
  const original = assertWorldSimulationSubjectiveChoiceCommitmentReceiptBundle(
    original_receipts,
  );
  if (!record(evidence)
      || evidence.schema_version !== "cc7ad-native-temporal-choice-stage-evidence-v1"
      || Object.keys(evidence).sort().join("|") !== [
        "schema_version", "source_original_receipt_id",
        "source_original_receipt_bundle_hash",
        "source_native_replay_audit_hash", "character",
        "initial_selection_kind", "initial_selection_scope",
        "response_selection_kind", "response_action_id",
        "response_release_time_ms", "original_phase74d_receipt_unchanged",
        "post_cue_phase74a_b_c_lineage_fabricated", "world_committed",
        "persist_only_with_atomic_world_commit", "evidence_hash",
        ...(evidence?.source_preparation_audit_hash !== undefined
          ? ["source_preparation_audit_hash", "preparation_decision_count"] : []),
      ].sort().join("|"))
    refuse("Native response commit evidence has invalid contract fields.");
  const { evidence_hash: hash, ...payload } = evidence;
  if (hash !== hashAgentRunValue(payload)
      || evidence.source_original_receipt_bundle_hash !== original.receipt_bundle_hash
      || evidence.initial_selection_kind !== "reject_all"
      || evidence.initial_selection_scope !== "pre_observer_cue_only"
      || evidence.response_selection_kind !== "candidate_action_intent"
      || evidence.original_phase74d_receipt_unchanged !== true
      || evidence.post_cue_phase74a_b_c_lineage_fabricated !== false
      || evidence.world_committed !== false
      || evidence.persist_only_with_atomic_world_commit !== true
      || !Number.isFinite(evidence.response_release_time_ms)
      || evidence.response_release_time_ms <= 0
      || typeof evidence.source_native_replay_audit_hash !== "string"
      || (evidence.source_preparation_audit_hash !== undefined
        && (typeof evidence.source_preparation_audit_hash !== "string"
          || !Number.isSafeInteger(evidence.preparation_decision_count)
          || evidence.preparation_decision_count < 1
          || evidence.preparation_decision_count > 32)))
    refuse("Native response commit evidence failed exact stage provenance.");
  const prior = original.receipts.filter((receipt) =>
    receipt.character === evidence.character
    && receipt.receipt_id === evidence.source_original_receipt_id
    && receipt.selection_kind === "reject_all"
    && receipt.action_id === null);
  const selected = (Array.isArray(selected_action_intents)
    ? selected_action_intents : []).filter((item) =>
    item.character === evidence.character
    && item.action_id === evidence.response_action_id
    && item.selection === "candidate_action_intent");
  const outcomes = (Array.isArray(action_outcomes)
    ? action_outcomes : []).filter((item) =>
    item.actor === evidence.character
    && item.action_id === evidence.response_action_id
    && item.result === "communication_emitted"
    && item.communication_event?.channel === "speech"
    && item.start_time_ms === evidence.response_release_time_ms);
  const releases = (Array.isArray(causal_timeline?.entries)
    ? causal_timeline.entries : []).filter((entry) =>
    entry.kind === "communication_speech_increment"
    && entry.action_id === evidence.response_action_id
    && entry.actor === evidence.character
    && entry.time_ms > evidence.response_release_time_ms);
  if (prior.length !== 1 || selected.length !== 1
      || outcomes.length !== 1 || releases.length === 0)
    refuse("Native response must commit one source-linked selected emitted speech.");
  return clone(evidence);
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
    ...(response.source_preparation_audit_hash ? {
      source_preparation_audit_hash: response.source_preparation_audit_hash,
      preparation_decision_count: response.source_preparation_consumed_count,
    } : {}),
  };
  return {
    ...evidence,
    evidence_hash: hashAgentRunValue(evidence),
  };
}
