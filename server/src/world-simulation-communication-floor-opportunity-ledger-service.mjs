import { hashAgentRunValue } from "./agent-run-service.mjs";
import { worldSimulationTurnIncrementHandoffVersion } from "./world-simulation-communication-turn-increment-handoff-service.mjs";
import { characterCommunicationTurnProjectionVersion } from "./character-communication-turn-projection-service.mjs";
import { characterCommunicationTurnParticipationIntentVersion } from "./character-communication-turn-participation-intent-service.mjs";
import { characterCommunicationTurnSelectionCueVersion } from "./character-communication-turn-selection-cue-service.mjs";

export const worldSimulationFloorOpportunityLedgerVersion =
  "cc7m-floor-opportunity-evidence-ledger-v1";

const record = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const copy = (value) => JSON.parse(JSON.stringify(value ?? null));
function reject(message) {
  const error = new Error(message);
  error.code = "CC7M_FLOOR_OPPORTUNITY_INVALID";
  throw error;
}
function bounded(value, name, max = 240) {
  if (typeof value !== "string" || !value.trim() || [...value.trim()].length > max)
    reject(`${name} must be bounded nonblank text.`);
  return value.trim();
}
function exact(value, keys, name) {
  if (!record(value) || Object.keys(value).some((key) => !keys.includes(key)))
    reject(`${name} contains non-contract fields.`);
}
const projectionKeys = [
  "schema_version", "projection_id", "observer", "perceived_speaker",
  "source_signal_ref", "source_increment_ref", "heard_surface_fragment",
  "signal_phase", "perceived_cue_refs", "turn_end_projection",
  "response_preparation", "lineage", "boundaries",
];
const participationKeys = [
  "schema_version", "intention_id", "observer", "perceived_speaker",
  "source_signal_ref", "source_increment_ref", "source_projection_id",
  "mode", "basis_refs", "response_plan_ref", "prior_intention_id",
  "revises_prior_intention", "subjective_only", "requires_external_floor_arbitration",
  "actual_floor_claimed", "backchannel_signal_emitted",
  "interruption_judged", "world_action_replanned",
];
const selectionKeys = [
  "schema_version", "selection_cue_id", "observer", "perceived_speaker",
  "source_signal_ref", "source_increment_ref", "source_projection_id",
  "source_meaning_interpretation_id", "status", "basis_refs",
  "prior_selection_cue_id", "revises_prior_selection_cue", "subjective_only",
  "actual_speaker_intent_claimed", "addressee_established",
  "floor_awarded", "world_signal_emitted", "world_action_replanned",
];
const selectionStatuses = new Set([
  "selected_me", "selected_other", "uncertain", "no_selection_evidence",
]);
const allowedModes = new Set([
  "wait", "remain_silent", "backchannel", "request_floor", "withdraw",
]);
const hash = (value, prefix) =>
  `${prefix}_${hashAgentRunValue(value).slice(0, 24)}`;

export function buildWorldSimulationFloorOpportunityLedgerContract() {
  return {
    version: worldSimulationFloorOpportunityLedgerVersion,
    input: "cc7d_admitted_observer_projections_and_cc7l_intents_only",
    temporal_order_is_evidence_not_priority: true,
    same_release_time_is_not_floor_tie_breaker: true,
    outstanding_requests_are_not_floor_ownership: true,
    backchannel_is_not_floor_request: true,
    overlap_is_not_interruption: true,
    no_intention_and_silence_are_legal: true,
    observer_and_signal_isolation: true,
    speaker_hidden_intent_available: false,
    audit_contains_surface_or_meaning_text: false,
    floor_winner_selected: false,
    actual_floor_claimed: false,
    backchannel_signal_emitted: false,
    interruption_judged: false,
    world_action_replanned: false,
    fixed_gap_threshold_used: false,
    belief_or_grounding_changed: false,
  };
}

/**
 * A passive ledger for one already-selected World turn. It accepts only
 * CC-7D/CC-7L records and preserves temporal order and observer-local
 * revision, not allocation of the World floor. The private view may guide
 * a future separate arbiter; only the text-free audit is history-safe.
 */
export function buildWorldSimulationFloorOpportunityLedger({
  handoff,
} = {}) {
  exact(handoff, [
    "schema_version", "resolver_used", "projected_count", "projections",
    "boundaries",
  ], "CC-7D handoff");
  if (handoff.schema_version !== worldSimulationTurnIncrementHandoffVersion
      || typeof handoff.resolver_used !== "boolean"
      || !Number.isInteger(handoff.projected_count)
      || handoff.projected_count < 0 || handoff.projected_count > 4096
      || !Array.isArray(handoff.projections)
      || handoff.projections.length !== handoff.projected_count
      || !record(handoff.boundaries)
      || handoff.boundaries.actual_mid_turn_world_action_replanning !== false)
    reject("CC-7M requires a canonical CC-7D bounded handoff.");

  const ordered = [];
  const previousProjectionBySignal = new Map();
  const priorParticipationBySignal = new Map();
  const priorSelectionBySignal = new Map();
  const latestModeBySignal = new Map();
  const auditEvents = [];
  const seen = new Set();
  const lastTimeBySignal = new Map();
  let lastReleaseTime = -1;
  for (const item of handoff.projections) {
    exact(item, [
      "schema_version", "observer", "release_time_ms", "projection",
      "participation_intent", "selection_cue", "source_meaning_interpretation_id",
      "subjective_only", "actual_world_action_replanned",
    ], "CC-7D projection entry");
    const projection = item.projection;
    exact(projection, projectionKeys, "CC-7A projection");
    const observer = bounded(item.observer, "observer");
    const signal = bounded(projection.source_signal_ref, "signal");
    const increment = bounded(projection.source_increment_ref, "increment");
    const speaker = bounded(projection.perceived_speaker, "perceived speaker");
    if (item.schema_version !== worldSimulationTurnIncrementHandoffVersion
        || projection.schema_version !== characterCommunicationTurnProjectionVersion
        || projection.observer !== observer || observer === speaker
        || !Number.isFinite(item.release_time_ms) || item.release_time_ms < 0
        || item.subjective_only !== true
        || item.actual_world_action_replanned !== false
        || !record(projection.turn_end_projection)
        || !Array.isArray(projection.turn_end_projection.basis_refs)
        || !record(projection.response_preparation)
        || !record(projection.lineage)
        || !record(projection.boundaries)
        || projection.turn_end_projection.subjective_only !== true
        || projection.turn_end_projection.world_turn_end_claimed !== false
        || projection.response_preparation.committed_action !== false
        || projection.response_preparation.world_signal_emitted !== false
        || projection.boundaries.floor_claimed !== false
        || projection.boundaries.floor_arbitrated !== false
        || projection.boundaries.backchannel_emitted !== false
        || projection.boundaries.overlap_classified_as_interruption !== false
        || projection.boundaries.grounding_claimed !== false
        || projection.boundaries.listener_belief_updated !== false)
      reject("CC-7M received an untrusted or world-committal turn projection.");
    const group = JSON.stringify([observer, signal]);
    const unique = JSON.stringify([group, increment]);
    if (seen.has(unique)) reject("Duplicate observer-signal increment.");
    seen.add(unique);
    if (item.release_time_ms < lastReleaseTime)
      reject("CC-7M requires chronological observer release order.");
    lastReleaseTime = item.release_time_ms;
    if (lastTimeBySignal.has(group)
        && item.release_time_ms <= lastTimeBySignal.get(group))
      reject("Observer-signal releases must advance strictly in time.");
    lastTimeBySignal.set(group, item.release_time_ms);
    const previousProjection = previousProjectionBySignal.get(group) ?? null;
    if (projection.lineage.prior_projection_id !== (previousProjection?.projection_id ?? null)
        || projection.lineage.revises_prior_projection !== Boolean(previousProjection))
      reject("CC-7A projection must continue the same observer-signal lineage.");
    const expectedProjection = hash({
      version: characterCommunicationTurnProjectionVersion,
      observer,
      speaker,
      signal_ref: signal,
      increment_ref: increment,
      turn_end_projection: projection.turn_end_projection.status,
      projection_basis_refs: projection.turn_end_projection.basis_refs,
      response_preparation: projection.response_preparation.state,
      response_plan_ref: projection.response_preparation.response_plan_ref,
      prior_projection_id: previousProjection?.projection_id ?? null,
    }, "cc7_turn_projection");
    if (projection.projection_id !== expectedProjection)
      reject("CC-7A projection identity does not match its contents.");
    previousProjectionBySignal.set(group, projection);
    const participation = item.participation_intent;
    const previous = priorParticipationBySignal.get(group) ?? null;
    let mode = "no_intention";
    if (participation !== null) {
      exact(participation, participationKeys, "CC-7L participation");
      mode = participation.mode;
      if (participation.schema_version !== characterCommunicationTurnParticipationIntentVersion
          || participation.observer !== observer
          || participation.perceived_speaker !== speaker
          || participation.source_signal_ref !== signal
          || participation.source_increment_ref !== increment
          || participation.source_projection_id !== projection.projection_id
          || participation.prior_intention_id !== (previous?.intention_id ?? null)
          || participation.revises_prior_intention !== Boolean(previous)
          || !allowedModes.has(mode)
          || !Array.isArray(participation.basis_refs)
          || participation.basis_refs.length > 16
          || new Set(participation.basis_refs).size !== participation.basis_refs.length
          || participation.basis_refs.some((ref) =>
            ref !== increment && !projection.perceived_cue_refs.includes(ref))
          || participation.subjective_only !== true
          || participation.actual_floor_claimed !== false
          || participation.backchannel_signal_emitted !== false
          || participation.interruption_judged !== false
          || participation.world_action_replanned !== false
          || participation.requires_external_floor_arbitration
            !== (mode === "request_floor")
          || ((mode === "request_floor") !==
             (participation.response_plan_ref !== null))
          || (mode === "request_floor"
             && (projection.response_preparation.state !== "ready"
                 || participation.response_plan_ref
                   !== projection.response_preparation.response_plan_ref))
          || (mode === "withdraw" && previous?.mode !== "request_floor")
          || (["request_floor", "backchannel"].includes(mode)
              && participation.basis_refs.length === 0))
        reject("CC-7L participation is foreign, unverified, or exceeds its authority.");
      const expectedIntention = hash({
        version: characterCommunicationTurnParticipationIntentVersion,
        observer,
        speaker,
        signal_ref: signal,
        increment_ref: increment,
        projection_id: projection.projection_id,
        mode,
        basis_refs: participation.basis_refs,
        response_plan_ref: participation.response_plan_ref,
        prior_intention_id: previous?.intention_id ?? null,
      }, "cc7_participation");
      if (participation.intention_id !== expectedIntention)
        reject("CC-7L intention identity does not match its contents.");
      priorParticipationBySignal.set(group, participation);
    } else {
      priorParticipationBySignal.delete(group);
    }
    const selection = item.selection_cue ?? null;
    const previousSelection = priorSelectionBySignal.get(group) ?? null;
    if (selection !== null) {
      exact(selection, selectionKeys, "CC-7O selection cue");
      if (selection.schema_version !== characterCommunicationTurnSelectionCueVersion
          || selection.observer !== observer
          || selection.perceived_speaker !== speaker
          || selection.source_signal_ref !== signal
          || selection.source_increment_ref !== increment
          || selection.source_projection_id !== projection.projection_id
          || selection.source_meaning_interpretation_id
            !== item.source_meaning_interpretation_id
          || selection.prior_selection_cue_id
            !== (previousSelection?.selection_cue_id ?? null)
          || selection.revises_prior_selection_cue !== Boolean(previousSelection)
          || !selectionStatuses.has(selection.status)
          || !Array.isArray(selection.basis_refs)
          || selection.basis_refs.length > 16
          || new Set(selection.basis_refs).size !== selection.basis_refs.length
          || selection.basis_refs.some((ref) => ref !== increment
            && !projection.perceived_cue_refs.includes(ref)
            && ref !== item.source_meaning_interpretation_id)
          || (["selected_me", "selected_other"].includes(selection.status)
            && selection.basis_refs.length === 0)
          || selection.subjective_only !== true
          || selection.actual_speaker_intent_claimed !== false
          || selection.addressee_established !== false
          || selection.floor_awarded !== false
          || selection.world_signal_emitted !== false
          || selection.world_action_replanned !== false)
        reject("CC-7O selection cue is foreign or exceeds observer authority.");
      const identity = {
        version: characterCommunicationTurnSelectionCueVersion,
        observer,
        speaker,
        signal_ref: signal,
        increment_ref: increment,
        projection_id: projection.projection_id,
        meaning_ref: selection.source_meaning_interpretation_id,
        status: selection.status,
        basis_refs: selection.basis_refs,
        prior_selection_cue_id: previousSelection?.selection_cue_id ?? null,
      };
      if (selection.selection_cue_id !== hash(identity, "cc7_selection_cue"))
        reject("CC-7O selection cue identity does not match its contents.");
      priorSelectionBySignal.set(group, selection);
    } else {
      priorSelectionBySignal.delete(group);
    }
    latestModeBySignal.set(group, {
      observer,
      signal,
      mode,
      intention_id: participation?.intention_id ?? null,
      release_time_ms: item.release_time_ms,
    });
    const event = {
      observer_ref: hash({ version: worldSimulationFloorOpportunityLedgerVersion, observer },
        "observer"),
      signal_ref: hash({ version: worldSimulationFloorOpportunityLedgerVersion,
        observer, signal }, "observed_signal"),
      release_time_ms: item.release_time_ms,
      mode,
      subjective_only: true,
      actual_floor_claimed: false,
      backchannel_signal_emitted: false,
      interruption_judged: false,
    };
    auditEvents.push(event);
    ordered.push({
      observer, signal_ref: signal, increment_ref: increment,
      release_time_ms: item.release_time_ms, mode,
      intention_id: participation?.intention_id ?? null,
    });
  }
  if (!handoff.resolver_used && ordered.length)
    reject("Uninstalled resolver cannot produce participation events.");
  const latest = [...latestModeBySignal.values()];
  const active = latest.filter((entry) => entry.mode === "request_floor");
  const distinctRequestingObservers =
    new Set(active.map((entry) => entry.observer)).size;
  const sameReleaseCount = new Map();
  for (const entry of auditEvents) {
    if (entry.mode !== "request_floor") continue;
    sameReleaseCount.set(entry.release_time_ms,
      (sameReleaseCount.get(entry.release_time_ms) ?? 0) + 1);
  }
  return copy({
    audit: {
      schema_version: worldSimulationFloorOpportunityLedgerVersion,
      status: handoff.resolver_used ? "opportunity_evidence_only" : "resolver_not_installed",
      entry_count: auditEvents.length,
      participation_count: auditEvents.filter((entry) =>
        entry.mode !== "no_intention").length,
      active_request_count: active.length,
      distinct_active_requesting_observer_count: distinctRequestingObservers,
      unresolved_competition_observed: distinctRequestingObservers > 1,
      same_release_time_request_groups:
        [...sameReleaseCount.values()].filter((count) => count > 1).length,
      backchannel_intent_count:
        auditEvents.filter((entry) => entry.mode === "backchannel").length,
      withdraw_intent_count:
        auditEvents.filter((entry) => entry.mode === "withdraw").length,
      events: auditEvents,
      boundaries: buildWorldSimulationFloorOpportunityLedgerContract(),
    },
    engine_private_opportunities: {
      ordered_observer_entries: ordered,
      latest_observer_signal_entries: latest,
      active_requesting_observers: [...new Set(active.map((entry) => entry.observer))],
      floor_winner: null,
      world_signal_emitted: false,
      interruption_judged: false,
    },
  });
}

export default buildWorldSimulationFloorOpportunityLedger;
