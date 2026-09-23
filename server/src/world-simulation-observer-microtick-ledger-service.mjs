import { hashAgentRunValue } from "./agent-run-service.mjs";
import { worldSimulationObserverSpeechIncrementVersion } from "./world-simulation-communication-observer-increment-service.mjs";

export const worldSimulationObserverMicrotickLedgerVersion =
  "cc7e-observer-microtick-release-ledger-v1";

const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const list = (value) => Array.isArray(value) ? value : [];
const copy = (value) => JSON.parse(JSON.stringify(value ?? null));

function reject(message) {
  const error = new Error(message);
  error.code = "CC7E_OBSERVER_MICROTICK_LEDGER_INVALID";
  throw error;
}
function required(value, label) {
  if (typeof value !== "string" || !value.trim() || [...value].length > 240)
    reject(`${label} requires bounded nonblank text.`);
  return value;
}

export function buildWorldSimulationObserverMicrotickLedgerContract() {
  return {
    version: worldSimulationObserverMicrotickLedgerVersion,
    source: "authoritative_causal_timeline_and_cc7c_observer_admissions",
    release_order: "time_ms_then_observer_then_anonymous_signal_ref",
    simultaneous_releases_share_one_microtick: true,
    engine_ledger_is_not_a_character_view: true,
    private_read_returns_only_current_tick_and_one_observer: true,
    future_cues_forwarded_to_observer: false,
    real_speaker_and_engine_action_ids_forwarded: false,
    speech_surface_or_semantics_forwarded: false,
    mid_turn_world_state_snapshot_available: false,
    already_selected_world_actions_replanned: false,
    runtime_character_brain_invoked_here: false,
    world_mutation_performed: false,
    floor_or_grounding_claimed: false,
  };
}

/**
 * A read-only release ledger for the pre-existing, already-resolved causal
 * turn. This is the chronological ingress contract for a future *real*
 * event scheduler, not a claim that this turn was committed microtick-by-
 * microtick. The caller must keep this entire engine ledger away from any
 * individual Character Brain; only readObserverMicrotickRelease is private.
 */
export function buildWorldSimulationObserverMicrotickLedger({
  causal_timeline,
  admissions = [],
} = {}) {
  // Older and custom causal adjudicators may legitimately return no
  // communication timeline at all. Preserve their no-speech turn behavior,
  // but refuse any observer evidence without an authoritative timeline.
  const entries = causal_timeline?.entries ??
    (Array.isArray(admissions) && admissions.length === 0 ? [] : null);
  if (!Array.isArray(entries) || entries.length > 20000
      || !Array.isArray(admissions) || admissions.length > 4096)
    reject("Causal timeline and observer admissions must be bounded lists.");
  const canonical = new Map();
  for (const entry of entries) {
    if (entry?.kind !== "communication_speech_increment") continue;
    const stream = required(entry.stream_id, "stream");
    const action = required(entry.action_id, "action");
    const actor = required(entry.actor, "actor");
    const phase = required(entry.signal_phase, "phase");
    if (!Number.isFinite(entry.time_ms) || entry.time_ms < 0
        || !Number.isSafeInteger(entry.increment_sequence)
        || entry.increment_sequence < 1)
      reject("Authoritative speech release has invalid time or sequence.");
    const key = JSON.stringify([stream, action, actor, entry.time_ms, phase]);
    canonical.set(key, (canonical.get(key) ?? 0) + 1);
  }
  const seen = new Set();
  const lastBySignal = new Map();
  const accepted = [];
  for (const receipt of admissions) {
    if (!isRecord(receipt) ||
        receipt.schema_version !== worldSimulationObserverSpeechIncrementVersion)
      reject("Observer admission schema mismatch.");
    const observer = required(receipt.observer, "observer");
    if (!Number.isFinite(receipt.release_time_ms) || receipt.release_time_ms < 0)
      reject("Observer release time must be finite and nonnegative.");
    if (receipt.admission_status !== "heard_acoustic_cues_only") {
      if (!["not_audible", "acoustic_evidence_unavailable"].includes(receipt.admission_status)
          || receipt.observer_increment !== null)
        reject("Inaudible admissions cannot carry observer increments.");
      continue;
    }
    const cue = receipt.observer_increment;
    const audit = receipt.audit;
    if (!isRecord(cue) || !isRecord(audit)
      || cue.schema_version !== "cc7-observer-speech-increment-v1"
      || cue.observer !== observer
      || cue.release_time_ms !== receipt.release_time_ms
      || cue.heard_surface_fragment !== null
      || cue.perceived_speaker !== null
      || cue.lexical_intelligibility_attested !== false
      || cue.speaker_identity_recognized !== false
      || cue.no_future_increment_exposed !== true
      || !["ongoing", "locally_suspended", "acoustic_segment_ended"].includes(cue.signal_phase)
      || !Array.isArray(cue.perceived_cue_refs) || cue.perceived_cue_refs.length !== 1
      || audit.registered_sound_link_verified !== true
      || audit.static_acoustics_scope_verified !== true
      || audit.source_content_forwarded_to_observer !== false)
      reject("Only verified, nonlexical, actually released CC-7C cues may enter the ledger.");

    const stream = required(audit.source_stream_id, "source stream");
    const action = required(audit.source_action_id, "source action");
    const actor = required(audit.source_speaker, "source actor");
    required(audit.source_sound_id, "source sound");
    const signalRef = required(cue.signal_ref, "observer signal");
    const incrementRef = required(cue.increment_ref, "observer increment");
    required(cue.perceived_cue_refs[0], "observer acoustic cue");
    if (actor === observer) reject("Self speech cannot enter the observer ledger.");
    const key = JSON.stringify([stream, action, actor, receipt.release_time_ms, cue.signal_phase]);
    if (canonical.get(key) !== 1)
      reject("Observer admission must match exactly one authoritative speech release.");
    const identity = JSON.stringify([observer, signalRef, incrementRef]);
    const lineage = JSON.stringify([observer, signalRef]);
    if (seen.has(identity)) reject("Duplicate observer release.");
    seen.add(identity);
    if (lastBySignal.has(lineage)
        && receipt.release_time_ms <= lastBySignal.get(lineage))
      reject("Observer signal releases must advance strictly in input order.");
    lastBySignal.set(lineage, receipt.release_time_ms);
    accepted.push({
      release_time_ms: receipt.release_time_ms,
      observer,
      signal_ref: signalRef,
      observer_increment: copy(cue),
    });
  }

  accepted.sort((a, b) => a.release_time_ms - b.release_time_ms
    || a.observer.localeCompare(b.observer, "en")
    || a.signal_ref.localeCompare(b.signal_ref, "en")
    || a.observer_increment.increment_ref.localeCompare(b.observer_increment.increment_ref, "en"));
  const ticks = [];
  for (const admission of accepted) {
    if (ticks.at(-1)?.release_time_ms !== admission.release_time_ms)
      ticks.push({ release_time_ms: admission.release_time_ms, observer_cues: [] });
    ticks.at(-1).observer_cues.push({
      observer: admission.observer,
      observer_increment: admission.observer_increment,
    });
  }
  const payload = {
    schema_version: worldSimulationObserverMicrotickLedgerVersion,
    ticks,
    tick_count: ticks.length,
    admitted_cue_count: accepted.length,
    boundaries: buildWorldSimulationObserverMicrotickLedgerContract(),
  };
  return copy({
    ...payload,
    ledger_hash: hashAgentRunValue(payload),
  });
}

/**
 * Sequential observer-only read. A caller cannot request an arbitrary future
 * tick by index: it must supply the exact cursor from the previous read.
 * Cursor storage/world microtick commit remain separate future engineering.
 */
export function readWorldSimulationObserverMicrotickRelease({
  ledger,
  observer,
  cursor = 0,
} = {}) {
  const listener = required(observer, "observer");
  if (!isRecord(ledger) || ledger.schema_version !== worldSimulationObserverMicrotickLedgerVersion
      || !Array.isArray(ledger.ticks) || ledger.tick_count !== ledger.ticks.length
      || !Number.isSafeInteger(cursor) || cursor < 0 || cursor > ledger.tick_count)
    reject("Observer read requires a valid ledger and bounded cursor.");
  const { ledger_hash, ...payload } = ledger;
  if (ledger_hash !== hashAgentRunValue(payload))
    reject("Observer read refuses a mutated or unverified release ledger.");
  if (cursor === ledger.tick_count)
    return { observer: listener, cursor, next_cursor: cursor, completed: true,
      release_time_ms: null, perceived_increments: [] };
  const tick = ledger.ticks[cursor];
  const own = tick.observer_cues.filter((item) => item.observer === listener)
    .map((item) => copy(item.observer_increment));
  return {
    observer: listener,
    cursor,
    next_cursor: cursor + 1,
    completed: false,
    release_time_ms: tick.release_time_ms,
    perceived_increments: own,
    no_future_releases_exposed: true,
    world_action_replanning_available: false,
  };
}
