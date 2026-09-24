import {
  buildWorldSimulationTurnAllocationReadiness,
  worldSimulationTurnAllocationReadinessVersion,
} from "./world-simulation-communication-turn-allocation-readiness-service.mjs";

export const worldSimulationSelectionAwareReadinessVersion =
  "cc7p-selection-aware-readiness-evidence-v1";

const copy = (value) => JSON.parse(JSON.stringify(value ?? null));
const key = (observer, signal) => JSON.stringify([observer, signal]);

export function buildWorldSimulationSelectionAwareReadinessContract() {
  return {
    version: worldSimulationSelectionAwareReadinessVersion,
    input_version: worldSimulationTurnAllocationReadinessVersion,
    cc7o_selection_cue_revalidated_through_cc7m: true,
    same_observer_signal_latest_release_only: true,
    selected_me_is_observer_hypothesis_only: true,
    selected_other_is_not_authoritative_disqualification: true,
    self_selection_is_not_automatically_authorized: true,
    selection_hint_does_not_create_floor_request: true,
    backchannel_does_not_create_floor_request: true,
    withdrawn_request_not_resurrected: true,
    actual_next_speaker_selected: false,
    world_floor_awarded: false,
    spoken_signal_emitted: false,
    interruption_judged: false,
    world_action_replanned: false,
    grounding_or_belief_changed: false,
    fixed_gap_threshold_used: false,
    audit_contains_surface_or_meaning_text: false,
    cross_observer_private_views_shared: false,
  };
}

/**
 * CC-7P is downstream of CC-7M's identity/lineage gate and CC-7N's
 * subjective readiness. This World-owned read-only summary never infers
 * actual speaker selection, actual transition, or new speaker actions.
 */
export function buildWorldSimulationSelectionAwareReadiness({
  handoff,
} = {}) {
  const base = buildWorldSimulationTurnAllocationReadiness({ handoff });
  const latest = new Map();
  for (const item of handoff.projections) {
    const projection = item.projection;
    latest.set(key(projection.observer, projection.source_signal_ref), {
      source_projection_id: projection.projection_id,
      release_time_ms: item.release_time_ms,
      selection_cue: item.selection_cue ?? null,
    });
  }
  const projected = base.engine_private_readiness.latest_observer_signal_entries;
  const audits = base.audit.entries;
  if (projected.length !== audits.length || projected.length !== latest.size)
    throw new Error("CC-7P observer signal cardinality does not match CC-7N.");
  const entries = projected.map((entry, index) => {
    const current = latest.get(key(entry.observer, entry.signal));
    if (!current
        || entry.source_projection_id !== current.source_projection_id
        || entry.release_time_ms !== current.release_time_ms)
      throw new Error("CC-7P latest observer-signal lineage does not match CC-7N.");
    const selection = current.selection_cue?.status ?? "no_selection_cue";
    const request = entry.mode === "request_floor";
    const candidate = entry.readiness === "subjective_candidate_not_awarded";
    let evidence_state;
    if (request && !candidate) {
      evidence_state = "completion_evidence_missing";
    } else if (request && selection === "selected_me") {
      evidence_state = "subjective_selected_me_request";
    } else if (request && selection === "selected_other") {
      evidence_state = "subjective_selection_conflict";
    } else if (request) {
      evidence_state = "self_selection_route_not_authorized";
    } else if (entry.mode === "backchannel") {
      evidence_state = "nonfloor_backchannel";
    } else if (entry.mode === "withdraw") {
      evidence_state = "withdrawn_request";
    } else if (selection === "selected_me") {
      evidence_state = "selection_hint_without_floor_request";
    } else {
      evidence_state = "not_seeking_floor";
    }
    return {
      ...entry,
      selection_status: selection,
      evidence_state,
      observer_ref: audits[index].observer_ref,
      signal_ref: audits[index].signal_ref,
    };
  });
  const requests = entries.filter((entry) => entry.mode === "request_floor");
  const selectedMeRequests = requests.filter((entry) =>
    entry.evidence_state === "subjective_selected_me_request");
  const conflicts = requests.filter((entry) =>
    entry.evidence_state === "subjective_selection_conflict");
  const selfRoute = requests.filter((entry) =>
    entry.evidence_state === "self_selection_route_not_authorized");
  if (requests.length !== base.audit.active_request_count)
    throw new Error("CC-7P active requests do not match CC-7N.");
  return copy({
    audit: {
      schema_version: worldSimulationSelectionAwareReadinessVersion,
      status: handoff.resolver_used
        ? "selection_and_readiness_evidence_only"
        : "resolver_not_installed",
      latest_observer_signal_count: entries.length,
      active_request_count: requests.length,
      subjective_selected_me_request_count: selectedMeRequests.length,
      subjective_selection_conflict_count: conflicts.length,
      unconfirmed_self_selection_route_count: selfRoute.length,
      selection_hint_without_floor_request_count: entries.filter((item) =>
        item.evidence_state === "selection_hint_without_floor_request").length,
      unresolved_competition_observed: base.audit.competition_unresolved,
      entries: entries.map((entry) => ({
        observer_ref: entry.observer_ref,
        signal_ref: entry.signal_ref,
        release_time_ms: entry.release_time_ms,
        mode: entry.mode,
        subjective_turn_end_projection: entry.turn_end_projection,
        subjective_selection_status: entry.selection_status,
        evidence_state: entry.evidence_state,
        floor_awarded: false,
        signal_emitted: false,
      })),
      boundaries: buildWorldSimulationSelectionAwareReadinessContract(),
    },
    engine_private_evidence: {
      latest_observer_signal_entries: entries.map((entry) => ({
        observer: entry.observer,
        signal_ref: entry.signal,
        release_time_ms: entry.release_time_ms,
        source_projection_id: entry.source_projection_id,
        source_intention_id: entry.source_intention_id,
        selection_status: entry.selection_status,
        evidence_state: entry.evidence_state,
      })),
      floor_winner: null,
      transition_authoritatively_available: false,
      speaker_selected_next: null,
      world_signal_emitted: false,
      world_action_replanned: false,
    },
  });
}

export default buildWorldSimulationSelectionAwareReadiness;
