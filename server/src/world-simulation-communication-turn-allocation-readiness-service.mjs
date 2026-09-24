import { hashAgentRunValue } from "./agent-run-service.mjs";
import {
  buildWorldSimulationFloorOpportunityLedger,
  worldSimulationFloorOpportunityLedgerVersion,
} from "./world-simulation-communication-floor-opportunity-ledger-service.mjs";

export const worldSimulationTurnAllocationReadinessVersion =
  "cc7n-subjective-turn-allocation-readiness-v1";

const copy = (value) => JSON.parse(JSON.stringify(value ?? null));
const observerRef = (observer) =>
  `observer_${hashAgentRunValue({
    version: worldSimulationTurnAllocationReadinessVersion, observer,
  }).slice(0, 24)}`;
const signalRef = (observer, signal) =>
  `observed_signal_${hashAgentRunValue({
    version: worldSimulationTurnAllocationReadinessVersion,
    observer, signal,
  }).slice(0, 24)}`;

export function buildWorldSimulationTurnAllocationReadinessContract() {
  return {
    version: worldSimulationTurnAllocationReadinessVersion,
    source_version: worldSimulationFloorOpportunityLedgerVersion,
    source_handoff_revalidated_before_readiness: true,
    latest_same_observer_signal_projection_only: true,
    subjective_projection_is_not_authoritative_transition: true,
    subjective_completion_does_not_award_floor: true,
    acoustic_segment_end_does_not_award_floor: true,
    sole_requester_does_not_auto_win: true,
    speaker_selects_next_evidence_not_available_here: true,
    backchannel_is_not_floor_request: true,
    silence_and_wait_legal: true,
    competition_not_resolved_by_arrival_order: true,
    cross_observer_projections_not_shared_with_resolvers: true,
    audit_contains_surface_or_meaning_text: false,
    actual_floor_claimed: false,
    winner_selected: false,
    backchannel_signal_emitted: false,
    interruption_judged: false,
    world_action_replanned: false,
    grounding_or_belief_changed: false,
    fixed_gap_threshold_used: false,
  };
}

/**
 * Analyze only the latest CC-7A/7L state per observer and perceived signal,
 * after CC-7M validates the exact source handoff and causal lineage. A
 * projection that a turn might complete can make a request a *candidate*,
 * never an actual allocation. Only a later World-owned causal gate could
 * authorize emission or floor transfer; none is invoked here.
 */
export function buildWorldSimulationTurnAllocationReadiness({
  handoff,
} = {}) {
  const ledger = buildWorldSimulationFloorOpportunityLedger({ handoff });
  const latest = new Map();
  for (const item of handoff.projections) {
    const projection = item.projection;
    const key = JSON.stringify([
      projection.observer, projection.source_signal_ref,
    ]);
    const mode = item.participation_intent?.mode ?? "no_intention";
    let readiness = "not_seeking_floor";
    if (mode === "request_floor") {
      readiness = [
        "possible_completion", "completed_for_current_joint_activity",
      ].includes(projection.turn_end_projection.status)
        ? "subjective_candidate_not_awarded"
        : "awaiting_subjective_completion_evidence";
    } else if (mode === "backchannel") {
      readiness = "nonfloor_backchannel";
    } else if (mode === "withdraw") {
      readiness = "request_withdrawn";
    }
    latest.set(key, {
      observer: projection.observer,
      signal: projection.source_signal_ref,
      release_time_ms: item.release_time_ms,
      source_projection_id: projection.projection_id,
      source_intention_id: item.participation_intent?.intention_id ?? null,
      signal_phase: projection.signal_phase,
      turn_end_projection: projection.turn_end_projection.status,
      mode,
      readiness,
    });
  }
  const entries = [...latest.values()].sort((a, b) =>
    a.release_time_ms - b.release_time_ms
    || a.observer.localeCompare(b.observer, "en")
    || a.signal.localeCompare(b.signal, "en"));
  const candidates = entries.filter((entry) =>
    entry.readiness === "subjective_candidate_not_awarded");
  const awaiting = entries.filter((entry) =>
    entry.readiness === "awaiting_subjective_completion_evidence");
  const activeCount = candidates.length + awaiting.length;
  if (activeCount !== ledger.audit.active_request_count) {
    const error = new Error(
      "CC-7N readiness and CC-7M active request counts disagree.");
    error.code = "CC7N_READINESS_LINEAGE_INVALID";
    throw error;
  }
  const distinctCandidates = new Set(candidates.map((e) => e.observer)).size;
  const privateReadiness = {
    latest_observer_signal_entries: entries,
    tentative_candidate_observers:
      [...new Set(candidates.map((entry) => entry.observer))],
    awaiting_observers: [...new Set(awaiting.map((entry) => entry.observer))],
    floor_winner: null,
    transition_authoritatively_available: false,
    speaker_selected_next: null,
    signal_emitted: false,
    world_action_replanned: false,
  };
  return copy({
    audit: {
      schema_version: worldSimulationTurnAllocationReadinessVersion,
      status: handoff.resolver_used
        ? "subjective_readiness_evidence_only" : "resolver_not_installed",
      latest_observer_signal_count: entries.length,
      active_request_count: activeCount,
      subjective_candidate_count: candidates.length,
      awaiting_subjective_completion_count: awaiting.length,
      distinct_candidate_observer_count: distinctCandidates,
      competition_unresolved:
        ledger.audit.unresolved_competition_observed,
      multiple_subjective_candidates: distinctCandidates > 1,
      sole_candidate_is_not_floor_winner: distinctCandidates === 1,
      entries: entries.map((entry) => ({
        observer_ref: observerRef(entry.observer),
        signal_ref: signalRef(entry.observer, entry.signal),
        release_time_ms: entry.release_time_ms,
        mode: entry.mode,
        subjective_projection: entry.turn_end_projection,
        readiness: entry.readiness,
        actual_floor_claimed: false,
        world_signal_emitted: false,
      })),
      boundaries: buildWorldSimulationTurnAllocationReadinessContract(),
    },
    engine_private_readiness: privateReadiness,
  });
}

export default buildWorldSimulationTurnAllocationReadiness;
