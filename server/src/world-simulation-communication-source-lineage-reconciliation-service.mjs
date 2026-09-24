import { hashAgentRunValue } from "./agent-run-service.mjs";
import { buildWorldSimulationSelectionAwareReadiness } from "./world-simulation-communication-selection-aware-readiness-service.mjs";
import { worldSimulationObserverSpeechIncrementVersion } from "./world-simulation-communication-observer-increment-service.mjs";
import { worldSimulationSpeakerNextTurnIntentVersion } from "./world-simulation-communication-speaker-next-turn-intent-service.mjs";

export const worldSimulationSourceLineageReconciliationVersion =
  "cc7r-world-owned-source-lineage-reconciliation-v1";

const record = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const copy = (v) => JSON.parse(JSON.stringify(v ?? null));
const hash = (v, prefix) =>
  `${prefix}_${hashAgentRunValue(v).slice(0, 24)}`;
const key = (...values) => JSON.stringify(values);
function fail(message) {
  const error = new Error(message);
  error.code = "CC7R_SOURCE_LINEAGE_INVALID";
  throw error;
}
function bounded(value) {
  return typeof value === "string" && value.trim()
    && [...value].length <= 240;
}
const modes = new Set(["nominate_addressee", "yield_open_floor", "retain_turn"]);
export function buildWorldSimulationSourceLineageReconciliationContract() {
  return {
    version: worldSimulationSourceLineageReconciliationVersion,
    world_owned_source_action_link_required: true,
    cc7c_acoustic_release_and_stream_increment_revalidated: true,
    cc7m_cc7p_observer_lineage_revalidated: true,
    cc7q_explicit_speaker_intent_identity_revalidated: true,
    anonymous_perceived_speaker_not_used_as_world_identity: true,
    addressee_not_automatic_next_speaker: true,
    no_acoustic_admission_means_no_observer_pair: true,
    silent_or_uninstalled_resolver_is_legal: true,
    observer_hypothesis_is_not_speaker_intent: true,
    private_world_join_never_forwarded_to_character_resolver: true,
    history_audit_contains_action_actor_sound_or_surface: false,
    floor_winner_selected: false,
    public_invitation_emitted: false,
    actual_floor_awarded: false,
    interruption_judged: false,
    world_action_replanned: false,
    grounding_or_belief_changed: false,
    fixed_gap_threshold_used: false,
  };
}

/**
 * World-owned, post-causal evidence join. One CC-7D entry must correspond to
 * exactly one actually audible CC-7C release, whose source is rederived from
 * the same emitted realized speech stream and registered acoustic sound.
 * CC-7Q intentions are separate speaker-authored post-causal hypotheses;
 * they are not disclosed to CC-7D listeners nor made into real floor awards.
 */
export function buildWorldSimulationSourceLineageReconciliation({
  handoff, admissions = [], action_outcomes = [], speaker_intent_projection,
} = {}) {
  const readiness =
    buildWorldSimulationSelectionAwareReadiness({ handoff });
  if (!Array.isArray(admissions) || admissions.length > 4096
      || !Array.isArray(action_outcomes) || action_outcomes.length > 4096
      || !record(speaker_intent_projection)
      || !record(speaker_intent_projection.audit)
      || !Array.isArray(speaker_intent_projection.engine_private_intentions)
      || speaker_intent_projection.engine_private_intentions.length > 4096
      || speaker_intent_projection.audit.schema_version
        !== worldSimulationSpeakerNextTurnIntentVersion)
    fail("CC-7R requires bounded canonical World and CC-7Q evidence.");
  const sources = new Map();
  for (const outcome of action_outcomes) {
    if (outcome?.result !== "communication_emitted"
        || outcome.communication_event?.channel !== "speech"
        || outcome.communication_event?.surface_realization_complete !== true)
      continue; // Valid legacy CC-1 speech is not a CC-7R stream.
    const stream = outcome.communication_speech_stream;
    const acoustic = outcome.communication_acoustic_signal;
    const event = outcome.communication_event;
    if (!bounded(outcome.actor) || !bounded(outcome.action_id)
        || event.schema_version !== "cc1-world-communication-event-v1"
        || event.actor !== outcome.actor
        || !bounded(event.addressee)
        || !record(event.surface_realization)
        || event.surface_realization.source_action_id !== outcome.action_id
        || event.surface_realization.surface_text !== event.surface_text
        || typeof event.surface_text !== "string"
        || !event.surface_text.trim())
      fail("CC-7R received an invalid realized speech source.");
    // CC-7Q speaker intention can exist without registered sound. Only an
    // observer join requires the CC-7C acoustic bridge.
    const hasAcousticBridge = record(stream)
      && stream.source_action_id === outcome.action_id
      && Array.isArray(stream.increments)
      && stream.increments.length > 0 && stream.increments.length <= 1200
      && record(acoustic) && acoustic.registered === true
      && acoustic.source_action_id === outcome.action_id
      && bounded(acoustic.sound_id);
    if (sources.has(outcome.action_id))
      fail("Duplicate eligible speech source action.");
    sources.set(outcome.action_id, {
      actor: outcome.actor,
      addressee: event.addressee,
      action_id: outcome.action_id,
      stream_id: hasAcousticBridge ? stream.stream_id : null,
      stream: hasAcousticBridge ? stream : null,
      sound_id: hasAcousticBridge ? acoustic.sound_id : null,
    });
  }
  const intentions = new Map();
  for (const item of speaker_intent_projection.engine_private_intentions) {
    const source = sources.get(item?.source_action_id);
    if (!source || intentions.has(item.source_action_id)
        || item.schema_version !== worldSimulationSpeakerNextTurnIntentVersion
        || item.actor !== source.actor
        || item.source_addressee !== source.addressee
        || !modes.has(item.mode)
        || (item.mode === "nominate_addressee"
          ? item.intended_next_speaker !== source.addressee
          : item.intended_next_speaker !== null)
        || item.provisional_only !== true
        || item.world_floor_awarded !== false
        || item.public_invitation_emitted !== false
        || item.world_action_replanned !== false)
      fail("CC-7Q speaker intention is foreign or exceeds its authority.");
    const id = hash({
      version: worldSimulationSpeakerNextTurnIntentVersion,
      actor: source.actor, action_id: source.action_id,
      addressee: source.addressee, mode: item.mode,
      target: item.intended_next_speaker,
    }, "speaker_next_turn_intent");
    if (id !== item.intention_id)
      fail("CC-7Q intention identity differs from the emitted source.");
    intentions.set(source.action_id, item);
  }
  if (intentions.size !== speaker_intent_projection.audit.decision_count
      || intentions.size !==
        (speaker_intent_projection.audit.nomination_count
        + speaker_intent_projection.audit.open_floor_yield_count
        + speaker_intent_projection.audit.retain_turn_count))
    fail("CC-7Q private intentions and audit counts disagree.");

  const receipts = new Map();
  for (const item of admissions) {
    if (item?.admission_status !== "heard_acoustic_cues_only") continue;
    const cue = item.observer_increment;
    const evidence = item.audit;
    const source = sources.get(evidence?.source_action_id);
    if (!source || !source.stream || !source.sound_id
        || item.schema_version !== worldSimulationObserverSpeechIncrementVersion
        || !bounded(item.observer) || source.actor === item.observer
        || !record(cue) || !record(evidence)
        || evidence.source_speaker !== source.actor
        || evidence.source_stream_id !== source.stream_id
        || evidence.source_sound_id !== source.sound_id
        || evidence.registered_sound_link_verified !== true
        || evidence.static_acoustics_scope_verified !== true
        || cue.observer !== item.observer
        || cue.heard_surface_fragment !== null
        || cue.perceived_speaker !== null
        || cue.lexical_intelligibility_attested !== false
        || cue.speaker_identity_recognized !== false
        || cue.no_future_increment_exposed !== true
        || cue.release_time_ms !== item.release_time_ms
        || !Number.isFinite(item.release_time_ms)
        || item.release_time_ms < 0)
      fail("CC-7C acoustic receipt is foreign or not actually admitted.");
    const signal = hash({
      version: worldSimulationObserverSpeechIncrementVersion,
      observer: item.observer, sound_id: source.sound_id,
    }, "observer_signal");
    const matching = source.stream.increments.filter((increment) =>
      increment.end_offset_ms === item.release_time_ms
      && cue.increment_ref === hash({
        version: worldSimulationObserverSpeechIncrementVersion,
        signal_ref: signal, increment_ref: increment.increment_ref,
      }, "observer_increment")
      && cue.perceived_cue_refs?.length === 1
      && cue.perceived_cue_refs[0] === hash({
        version: worldSimulationObserverSpeechIncrementVersion,
        signal_ref: signal, increment_ref: increment.increment_ref,
      }, "audible_cue")
      && cue.signal_phase === increment.signal_phase);
    if (cue.signal_ref !== signal || matching.length !== 1)
      fail("CC-7C release is not linked to a current stream increment.");
    const receiptKey = key(item.observer, cue.signal_ref,
      cue.increment_ref, item.release_time_ms);
    if (receipts.has(receiptKey))
      fail("Duplicate audible CC-7C receipt.");
    receipts.set(receiptKey, { source, receipt: item });
  }

  const joined = [];
  const latest = new Map();
  for (const item of handoff.projections) {
    const p = item.projection;
    const r = receipts.get(key(item.observer, p.source_signal_ref,
      p.source_increment_ref, item.release_time_ms));
    if (!r) fail("CC-7D projection lacks one matching admitted CC-7C release.");
    const group = key(item.observer, p.source_signal_ref);
    const prior = latest.get(group);
    if (prior && prior.source_action_id !== r.source.action_id)
      fail("One observer signal was silently reassigned to another speech action.");
    latest.set(group, {
      observer: item.observer,
      signal_ref: p.source_signal_ref,
      source_action_id: r.source.action_id,
      source_actor: r.source.actor,
      release_time_ms: item.release_time_ms,
    });
  }
  for (const entry of readiness.engine_private_evidence.latest_observer_signal_entries) {
    const source = latest.get(key(entry.observer, entry.signal_ref));
    if (!source || source.release_time_ms !== entry.release_time_ms)
      fail("CC-7P latest observer projection has no current World source.");
    const intention = intentions.get(source.source_action_id) ?? null;
    let relation = "no_speaker_intention";
    if (intention?.mode === "retain_turn") relation = "speaker_intends_retain_turn";
    else if (intention?.mode === "yield_open_floor")
      relation = "speaker_intends_open_floor";
    else if (intention?.mode === "nominate_addressee")
      relation = intention.intended_next_speaker === entry.observer
        ? "speaker_intends_nominate_this_observer"
        : "speaker_intends_nominate_other";
    joined.push({
      ...source,
      source_projection_id: entry.source_projection_id,
      listener_mode: entry.evidence_state,
      listener_selection_status: entry.selection_status,
      speaker_intent_id: intention?.intention_id ?? null,
      speaker_intent_mode: intention?.mode ?? null,
      speaker_intent_relation: relation,
      actual_floor_awarded: false,
      world_signal_emitted: false,
    });
  }
  const auditEntries = joined.map((entry) => ({
    source_ref: hash({
      version: worldSimulationSourceLineageReconciliationVersion,
      action: entry.source_action_id,
    }, "world_source"),
    observer_ref: hash({
      version: worldSimulationSourceLineageReconciliationVersion,
      observer: entry.observer,
    }, "observer"),
    release_time_ms: entry.release_time_ms,
    listener_evidence_state: entry.listener_mode,
    speaker_intent_relation: entry.speaker_intent_relation,
    actual_floor_awarded: false,
    world_signal_emitted: false,
  }));
  return copy({
    audit: {
      schema_version: worldSimulationSourceLineageReconciliationVersion,
      status: "world_source_lineage_evidence_only",
      eligible_source_count: sources.size,
      emitted_speaker_intention_count: intentions.size,
      audible_receipt_count: receipts.size,
      linked_latest_observer_count: joined.length,
      unmatched_intention_count: [...intentions.keys()].filter((id) =>
        !joined.some((entry) => entry.source_action_id === id)).length,
      entries: auditEntries,
      boundaries: buildWorldSimulationSourceLineageReconciliationContract(),
    },
    engine_private_world_evidence: {
      joined_observer_sources: joined,
      actual_floor_awarded: false,
      next_speaker_selected: null,
      world_action_replanned: false,
    },
  });
}

export default buildWorldSimulationSourceLineageReconciliation;
