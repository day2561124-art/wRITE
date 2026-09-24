import { hashAgentRunValue } from "./agent-run-service.mjs";
import {
  getWorldSimulationHistory,
  getWorldSimulationState,
} from "./world-simulation-state-service.mjs";
import {
  assertWorldSimulationSubjectiveChoiceCommitmentReceiptBundle,
} from "./world-simulation-subjective-choice-commitment-receipt-service.mjs";
import {
  buildWorldSimulationObserverMicrotickLedger,
} from "./world-simulation-observer-microtick-ledger-service.mjs";
import {
  worldSimulationObserverSpeechIncrementVersion,
} from "./world-simulation-communication-observer-increment-service.mjs";

export const worldSimulationNativeCommittedSourceVersion =
  "cc7af-authoritative-committed-acoustic-source-v1";
const record = value => value !== null && typeof value === "object"
  && !Array.isArray(value);
const copy = value => JSON.parse(JSON.stringify(value ?? null));

function reject(message) {
  const error = new Error(message);
  error.code = "CC7AF_COMMITTED_SOURCE_INVALID";
  throw error;
}
function required(value, label) {
  if (typeof value !== "string" || !value.trim() || value.length > 240)
    reject(label + " must be a bounded nonblank source identifier.");
  return value;
}
function assertHistoryChain(history, snapshot, session_id) {
  const turns = history?.turns;
  if (!record(history) || history.world_simulation_session_id !== session_id
      || !Array.isArray(turns) || turns.length > 4096
      || snapshot?.world_simulation_session_id !== session_id
      || !Number.isSafeInteger(snapshot.revision) || snapshot.revision < 0
      || hashAgentRunValue(snapshot.state) !== snapshot.state_hash
      || snapshot.revision !== turns.length)
    reject("World state and append-only committed turn history disagree.");
  let priorHash = null;
  for (let i = 0; i < turns.length; i += 1) {
    const turn = turns[i];
    if (!record(turn) || turn.revision_from !== i
        || turn.revision_to !== i + 1
        || typeof turn.turn_id !== "string" || !turn.turn_id
        || typeof turn.previous_state_hash !== "string"
        || typeof turn.next_state_hash !== "string"
        || (i > 0 && priorHash !== turn.previous_state_hash))
      reject("Committed World history has a broken revision/hash chain.");
    priorHash = turn.next_state_hash;
  }
  if (turns.length > 0 && priorHash !== snapshot.state_hash)
    reject("Committed World history does not lead to the current state.");
  return turns;
}

/**
 * Engine-only, authoritative history read. An input token is never
 * interpreted as cancellation authority. This proves that the physical
 * source was actually committed and the specified observer actually had
 * an admitted acoustic increment; it CANNOT retract any of that history.
 */
export async function assertWorldSimulationCommittedAcousticSource({
  session_id, source_turn_id, source_turn_hash, source_action_id,
  source_character, observer, observer_increment_ref, release_time_ms,
  expected_source_receipt_bundle_hash,
  expected_source_revision_to, expected_source_next_state_hash,
  expected_current_revision, expected_current_state_hash,
} = {}, options = {}) {
  for (const [label, value] of Object.entries({
    session_id, source_turn_id, source_turn_hash, source_action_id,
    source_character, observer, observer_increment_ref,
    expected_source_receipt_bundle_hash, expected_source_next_state_hash,
  })) required(value, label);
  if (source_character === observer
      || !Number.isFinite(release_time_ms) || release_time_ms < 0
      || !Number.isSafeInteger(expected_source_revision_to)
      || expected_source_revision_to < 1
      || !Number.isSafeInteger(expected_current_revision)
      || expected_current_revision < expected_source_revision_to
      || typeof expected_current_state_hash !== "string"
      || !expected_current_state_hash)
    reject("Committed source and current World dependency require exact revisions.");
  // Read both from the existing World state service; no caller-owned history
  // object, copy, alternate storage or ad hoc cancellation flag is accepted.
  const [history, snapshot] = await Promise.all([
    getWorldSimulationHistory(session_id, options),
    getWorldSimulationState(session_id, options),
  ]);
  const turns = assertHistoryChain(history, snapshot, session_id);
  if (snapshot.revision !== expected_current_revision
      || snapshot.state_hash !== expected_current_state_hash)
    reject("Speculative dependency is stale against the current World CAS.");
  const matches = turns.filter(item => item.turn_id === source_turn_id);
  if (matches.length !== 1)
    reject("Source turn must exist exactly once in authoritative history.");
  const source = matches[0];
  if (hashAgentRunValue(source) !== source_turn_hash
      || source.revision_to !== expected_source_revision_to
      || source.next_state_hash !== expected_source_next_state_hash
      || source.revision_to > snapshot.revision)
    reject("Committed source turn identity or revision has changed.");
  const receipts = source.subjective_choice_commitment_receipts;
  assertWorldSimulationSubjectiveChoiceCommitmentReceiptBundle(receipts,{
    world_simulation_session_id: session_id, turn_id: source_turn_id,
    state_revision: source.revision_from,
    world_state_hash: source.previous_state_hash,
  });
  if (receipts.receipt_bundle_hash !== expected_source_receipt_bundle_hash)
    reject("Committed source Phase74D receipt bundle differs from dependency.");
  const selected = (source.selected_action_intents ?? []).filter(item =>
    item.character === source_character
    && item.action_id === source_action_id
    && item.selection === "candidate_action_intent");
  const receipt = receipts.receipts.filter(item =>
    item.character === source_character
    && item.action_id === source_action_id
    && item.selection_kind === "candidate_action_intent");
  const emitted = (source.action_outcomes ?? []).filter(item =>
    item.actor === source_character
    && item.action_id === source_action_id
    && item.result === "communication_emitted"
    && item.communication_event?.channel === "speech");
  if (selected.length !== 1 || receipt.length !== 1 || emitted.length !== 1)
    reject("Source character must own one selected, committed speech outcome.");
  const timeline = source.causal_timeline;
  // Reuse the canonical CC-7E ledger validator, rather than trusting
  // a fragment-shaped object or inventing lexical/speaker perception.
  buildWorldSimulationObserverMicrotickLedger({
    causal_timeline: timeline,
    admissions: source.communication_observer_increment_admissions,
  });
  const admission = source.communication_observer_increment_admissions.filter(
    item => item.observer === observer
      && item.admission_status === "heard_acoustic_cues_only"
      && item.release_time_ms === release_time_ms
      && item.observer_increment?.increment_ref === observer_increment_ref
      && item.audit?.source_action_id === source_action_id
      && item.audit?.source_speaker === source_character,
  );
  if (admission.length !== 1)
    reject("Observer has no exact committed acoustic source admission.");
  const acoustic = admission[0];
  const timelineMatches = (timeline?.entries ?? []).filter(item =>
    item.kind === "communication_speech_increment"
    && item.action_id === source_action_id
    && item.actor === source_character
    && item.time_ms === release_time_ms
    && item.stream_id === acoustic.audit.source_stream_id
    && item.signal_phase === acoustic.observer_increment.signal_phase);
  if (timelineMatches.length !== 1)
    reject("Committed acoustic source does not match the World release.");
  const entry = timelineMatches[0];
  const stream = emitted[0].communication_speech_stream;
  if (!record(stream)
      || stream.stream_id !== acoustic.audit.source_stream_id
      || stream.source_action_id !== source_action_id
      || !Array.isArray(stream.increments)
      || stream.increments.filter(increment =>
        increment.increment_ref === entry.increment_ref
        && increment.sequence === entry.increment_sequence
        && increment.signal_phase === entry.signal_phase
        && (increment.release_time_ms ?? increment.end_offset_ms)
          === release_time_ms).length !== 1)
    reject("Committed speech stream does not own this source increment.");
  // Recompute CC-7C's exact observer identities from the authoritative
  // speech increment and registered sound, not from caller-controlled refs.
  const expectedSignalRef = `observer_signal_${hashAgentRunValue({
    version:worldSimulationObserverSpeechIncrementVersion,
    observer,sound_id:acoustic.audit.source_sound_id,
  }).slice(0,24)}`;
  const cueSuffix = hashAgentRunValue({
    version:worldSimulationObserverSpeechIncrementVersion,
    signal_ref:expectedSignalRef,
    increment_ref:entry.increment_ref,
  }).slice(0,24);
  if (acoustic.observer_increment.signal_ref !== expectedSignalRef
      || acoustic.observer_increment.increment_ref
        !== `observer_increment_${cueSuffix}`
      || JSON.stringify(acoustic.observer_increment.perceived_cue_refs)
        !== JSON.stringify([`audible_cue_${cueSuffix}`]))
    reject("Committed observer acoustic increment identity does not match its sound.");
  const audit = {
    schema_version: worldSimulationNativeCommittedSourceVersion,
    status:"committed_source_verified_without_retraction",
    source_turn_hash:source_turn_hash,
    source_turn_revision_to:source.revision_to,
    source_next_state_hash:source.next_state_hash,
    source_receipt_bundle_hash:receipts.receipt_bundle_hash,
    source_receipt_id:receipt[0].receipt_id,
    source_action_ref_hash:hashAgentRunValue({
      actor:source_character,action_id:source_action_id,
      stream_id:acoustic.audit.source_stream_id,
      sound_id:acoustic.audit.source_sound_id,
    }),
    source_observer_increment_ref_hash:hashAgentRunValue({
      observer,observer_increment_ref,release_time_ms,
    }),
    observer_ref:"observer_"+hashAgentRunValue(observer).slice(0,24),
    source_release_time_ms:release_time_ms,
    checked_current_revision:snapshot.revision,
    checked_current_state_hash:snapshot.state_hash,
    previously_committed_sound_retracted:false,
    speculative_dependency_authorized_to_speak:false,
    character_brain_invoked:false,
    world_mutation_performed:false,
    interruption_inferred:false,
  };
  return copy({...audit,audit_hash:hashAgentRunValue(audit)});
}

// CC-7AF: a broker-authored follow-up REQUEST is not a source receipt.
// Only the canonical causal resolution can stamp a scheduled queue entry
// after it has actually emitted speech and admitted an acoustic increment.
export const worldSimulationNativeQueuedSourceVersion =
  "cc7af-queued-acoustic-source-lineage-v1";
export const worldSimulationNativeQueuedSourceRequestVersion =
  "cc7af-queued-acoustic-source-request-v1";

export function buildWorldSimulationNativeQueuedAcousticSource({
  request, event_id, session_id, source_turn_id,
  source_world_state_hash, source_revision_to,
  selected_action_intents, action_outcomes, observer_admissions,
} = {}) {
  if (!record(request)
      || Object.keys(request).sort().join("|")
        !== "observer|schema_version|source_character"
      || request.schema_version
        !== worldSimulationNativeQueuedSourceRequestVersion
      || typeof event_id !== "string" || !event_id
      || typeof session_id !== "string" || !session_id
      || typeof source_turn_id !== "string" || !source_turn_id
      || typeof source_world_state_hash !== "string"
      || !source_world_state_hash
      || !Number.isSafeInteger(source_revision_to)
      || source_revision_to < 1
      || typeof request.source_character !== "string"
      || !request.source_character.trim()
      || typeof request.observer !== "string"
      || !request.observer.trim()
      || request.source_character === request.observer)
    reject("Queued source request must name a bounded real speaker and observer.");
  const selected = (selected_action_intents ?? []).filter(item =>
    item.character === request.source_character
      && item.selection === "candidate_action_intent");
  const emitted = (action_outcomes ?? []).filter(item =>
    item.actor === request.source_character
      && item.result === "communication_emitted"
      && item.communication_event?.channel === "speech");
  if (selected.length !== 1 || emitted.length !== 1
      || selected[0].action_id !== emitted[0].action_id)
    reject("Requested future source has no unique actually emitted speech.");
  const admissions = (observer_admissions ?? []).filter(item =>
    item.observer === request.observer
      && item.admission_status === "heard_acoustic_cues_only"
      && item.audit?.source_action_id === emitted[0].action_id
      && item.audit?.source_speaker === request.source_character
      && typeof item.observer_increment?.increment_ref === "string");
  if (!admissions.length)
    reject("Requested future dependency has no actual observer acoustic release.");
  admissions.sort((a,b) => a.release_time_ms-b.release_time_ms
    || a.observer_increment.increment_ref.localeCompare(
      b.observer_increment.increment_ref,"en"));
  const first = admissions[0];
  const payload = {
    schema_version:worldSimulationNativeQueuedSourceVersion,
    event_id,session_id,source_turn_id,
    source_world_state_hash,source_revision_to,
    source_character:request.source_character,observer:request.observer,
    source_action_id:emitted[0].action_id,
    observer_increment_ref:first.observer_increment.increment_ref,
    release_time_ms:first.release_time_ms,
  };
  return copy({...payload,lineage_hash:hashAgentRunValue(payload)});
}

/**
 * Read the ACTUAL queue head from World State. The event object supplied
 * by a caller never serves as provenance. Verify the origin event's
 * originally requested follow-up before interpreting the immutable
 * committed acoustic source; reject all caller-rehashed substitutions.
 */
export async function assertWorldSimulationQueuedAcousticSource({
  session_id, event_id, expected_current_revision,
  expected_current_state_hash, queue_index = 0,
} = {}, options = {}) {
  required(session_id,"session_id");
  required(event_id,"event_id");
  if (!Number.isSafeInteger(queue_index) || queue_index < 0)
    reject("Queued source requires a bounded World queue index.");
  const [snapshot,history] = await Promise.all([
    getWorldSimulationState(session_id,options),
    getWorldSimulationHistory(session_id,options),
  ]);
  if (snapshot.revision !== expected_current_revision
      || snapshot.state_hash !== expected_current_state_hash)
    reject("Queued dependency is stale against current World CAS.");
  const event = snapshot.state?.event_queue?.[queue_index];
  const marker = event?.native_acoustic_source_lineage;
  if ((event?.event_id ?? event?.id) !== event_id
      || !record(marker)
      || marker.schema_version !== worldSimulationNativeQueuedSourceVersion
      || marker.session_id !== session_id
      || marker.event_id !== event_id
      || marker.lineage_hash !== hashAgentRunValue(
        Object.fromEntries(Object.entries(marker).filter(
          ([key])=>key!=="lineage_hash"))))
    reject("Queued event has no valid engine-generated acoustic dependency.");
  const origin = (history.turns ?? []).filter(item =>
    item.turn_id === marker.source_turn_id
      && item.revision_to === marker.source_revision_to
      && item.previous_state_hash === marker.source_world_state_hash);
  if (origin.length !== 1)
    reject("Queued event is not bound to one committed originating turn.");
  const requests=(origin[0].event?.next_events
    ?? origin[0].event?.follow_up_events ?? []).filter(item =>
      (item.event_id ?? item.id) === event_id
      && JSON.stringify(item.native_acoustic_dependency_request) ===
        JSON.stringify({
          schema_version:worldSimulationNativeQueuedSourceRequestVersion,
          source_character:marker.source_character,
          observer:marker.observer,
        }));
  if (requests.length !== 1)
    reject("Queued acoustic dependency was not requested by the originating event.");
  const rebuilt=buildWorldSimulationNativeQueuedAcousticSource({
    request:requests[0].native_acoustic_dependency_request,
    event_id,session_id,source_turn_id:origin[0].turn_id,
    source_world_state_hash:origin[0].previous_state_hash,
    source_revision_to:origin[0].revision_to,
    selected_action_intents:origin[0].selected_action_intents,
    action_outcomes:origin[0].action_outcomes,
    observer_admissions:origin[0].communication_observer_increment_admissions,
  });
  if (JSON.stringify(marker)!==JSON.stringify(rebuilt))
    reject("Queued source identity is not the originating World causal result.");
  const source=origin[0];
  const audit=await assertWorldSimulationCommittedAcousticSource({
    session_id,source_turn_id:source.turn_id,
    source_turn_hash:hashAgentRunValue(source),
    source_action_id:marker.source_action_id,
    source_character:marker.source_character,observer:marker.observer,
    observer_increment_ref:marker.observer_increment_ref,
    release_time_ms:marker.release_time_ms,
    expected_source_receipt_bundle_hash:
      source.subjective_choice_commitment_receipts?.receipt_bundle_hash,
    expected_source_revision_to:source.revision_to,
    expected_source_next_state_hash:source.next_state_hash,
    expected_current_revision,expected_current_state_hash,
  },options);
  return copy({event_id,observer:marker.observer,
    source_turn_hash:audit.source_turn_hash,
    source_observer_increment_ref_hash:
      audit.source_observer_increment_ref_hash,
    source_release_time_ms:audit.source_release_time_ms,
    checked_current_revision:audit.checked_current_revision,
    checked_current_state_hash:audit.checked_current_state_hash,
    prior_sound_retracted:false,
    authorizes_current_speech:false});
}

export const worldSimulationNativePendingCancellationVersion =
  "cc7af-pending-queued-acoustic-cancellation-plan-v1";

/**
 * ENGINE ONLY, read-only: an actual World queue-head event explicitly
 * declares which not-yet-executed dependent event it wants to invalidate.
 * Re-check each target's complete committed-source lineage before planning.
 * The caller cannot name a target or decide that old sound was cancelled.
 * Applying the plan remains a separate canonical World CAS/commit slice.
 */
export async function assessWorldSimulationPendingAcousticCancellation({
  session_id, event_id, expected_current_revision,
  expected_current_state_hash,
} = {}, options = {}) {
  required(session_id,"session_id");
  required(event_id,"event_id");
  const snapshot=await getWorldSimulationState(session_id,options);
  if (snapshot.revision!==expected_current_revision
      || snapshot.state_hash!==expected_current_state_hash)
    reject("Pending cancellation is stale against current World CAS.");
  const queue=snapshot.state?.event_queue;
  if (!Array.isArray(queue) || queue.length>4096 || queue.length<2)
    reject("Pending cancellation requires a real future World queue entry.");
  const current=queue[0];
  if ((current?.event_id??current?.id)!==event_id
      || !Array.isArray(current.native_acoustic_cancellation_requests)
      || current.native_acoustic_cancellation_requests.length<1
      || current.native_acoustic_cancellation_requests.length>16)
    reject("World queue head has no bounded pending cancellation request.");
  const targets=[];
  const seen=new Set();
  for (const request of current.native_acoustic_cancellation_requests) {
    if (!record(request)
        || Object.keys(request).sort().join("|")
          !== "event_id|observer|source_character"
        || typeof request.event_id!=="string" || !request.event_id
        || typeof request.source_character!=="string"
        || !request.source_character
        || typeof request.observer!=="string" || !request.observer
        || request.observer===request.source_character
        || seen.has(request.event_id))
      reject("Cancellation request must name one distinct real future source.");
    seen.add(request.event_id);
    const matches=queue.slice(1).map((value,index)=>({
      value,index:index+1,
    })).filter(({value})=>
      (value?.event_id??value?.id)===request.event_id);
    if (matches.length!==1)
      reject("Requested cancellation target must exist once after queue head.");
    const {value:future,index}=matches[0];
    const lineage=future.native_acoustic_source_lineage;
    if (!record(lineage)
        || lineage.source_character!==request.source_character
        || lineage.observer!==request.observer)
      reject("Cancellation target must carry a matching actual acoustic source.");
    const verified=await assertWorldSimulationQueuedAcousticSource({
      session_id,event_id:request.event_id,queue_index:index,
      expected_current_revision,expected_current_state_hash,
    },options);
    targets.push({
      event_id:request.event_id,source_lineage_hash:lineage.lineage_hash,
      source_turn_hash:verified.source_turn_hash,
      source_observer_increment_ref_hash:
        verified.source_observer_increment_ref_hash,
    });
  }
  const audit={
    schema_version:worldSimulationNativePendingCancellationVersion,
    status:"verified_future_dependency_invalidation_plan_only",
    session_id,event_id,expected_current_revision,
    expected_current_state_hash,
    target_count:targets.length,targets,
    world_queue_mutated:false,world_committed:false,
    prior_sound_retracted:false,
    brain_invoked:false,interruption_inferred:false,
  };
  return copy({...audit,audit_hash:hashAgentRunValue(audit)});
}
