import { hashAgentRunValue } from "./agent-run-service.mjs";
import {
  buildWorldSimulationSourceLineageReconciliation,
  worldSimulationSourceLineageReconciliationVersion,
} from "./world-simulation-communication-source-lineage-reconciliation-service.mjs";

export const worldSimulationFloorTransitionAdmissionVersion =
  "cc7s-world-floor-transition-admission-v1";

const copy = (v) => JSON.parse(JSON.stringify(v ?? null));
const ref = (type, value) =>
  `${type}_${hashAgentRunValue({
    version: worldSimulationFloorTransitionAdmissionVersion, value,
  }).slice(0, 24)}`;

/**
 * Revalidate actual World source identity through CC-7R before classifying any
 * possible floor handoff. CC-7Q intention is NOT a public invitation, CC-7P
 * subjective completion is NOT an actual turn end, and a CC-7B technical
 * stream boundary is NOT a conversational transition-relevance place.
 * Nothing here awards a floor or emits a World/character signal.
 */
export function buildWorldSimulationFloorTransitionAdmission({
  handoff, admissions, action_outcomes, speaker_intent_projection,
} = {}) {
  const reconciled = buildWorldSimulationSourceLineageReconciliation({
    handoff, admissions, action_outcomes, speaker_intent_projection,
  });
  if (reconciled.audit.schema_version !==
      worldSimulationSourceLineageReconciliationVersion ||
      reconciled.audit.status !== "world_source_lineage_evidence_only" ||
      reconciled.engine_private_world_evidence.actual_floor_awarded !== false) {
    const error = new Error("CC-7S requires revalidated CC-7R evidence.");
    error.code = "CC7S_FLOOR_TRANSITION_INVALID";
    throw error;
  }
  const entries = [];
  for (const source of reconciled.engine_private_world_evidence
    .joined_observer_sources) {
    // All categories remain NON-COMMITTAL. Even an explicit speaker
    // nomination has not yet produced a public invitation perceivable by B.
    let admission = "no_floor_request";
    if (source.listener_mode === "completion_evidence_missing") {
      admission = "awaiting_subjective_completion";
    } else if (source.listener_mode === "withdrawn_request") {
      admission = "request_withdrawn";
    } else if (source.listener_mode === "nonfloor_backchannel") {
      admission = "nonfloor_backchannel";
    } else if (source.listener_mode === "subjective_selection_conflict") {
      admission = "unresolved_subjective_selection_conflict";
    } else if (source.listener_mode === "subjective_selected_me_request" ||
               source.listener_mode === "self_selection_route_not_authorized") {
      if (source.speaker_intent_relation === "speaker_intends_nominate_this_observer")
        admission = "nomination_pending_public_signal";
      else if (source.speaker_intent_relation === "speaker_intends_open_floor")
        admission = "self_selection_pending_world_action";
      else if (source.speaker_intent_relation === "speaker_intends_retain_turn")
        admission = "speaker_intends_retention";
      else if (source.speaker_intent_relation === "speaker_intends_nominate_other")
        admission = "speaker_intends_other";
      else admission = "no_authorized_transition";
    }
    entries.push({
      observer: source.observer,
      source_action_id: source.source_action_id,
      source_projection_id: source.source_projection_id,
      speaker_intent_id: source.speaker_intent_id,
      admission,
      actual_floor_awarded: false,
      public_invitation_observed: false,
      next_speaker_selected: null,
    });
  }
  return copy({
    audit: {
      schema_version: worldSimulationFloorTransitionAdmissionVersion,
      status: "pretransition_evidence_only",
      observer_count: entries.length,
      nomination_pending_count: entries.filter((entry) =>
        entry.admission === "nomination_pending_public_signal").length,
      self_selection_pending_count: entries.filter((entry) =>
        entry.admission === "self_selection_pending_world_action").length,
      entries: entries.map((entry) => ({
        observer_ref: ref("observer", entry.observer),
        source_ref: ref("world_source", entry.source_action_id),
        admission: entry.admission,
        actual_floor_awarded: false,
        public_invitation_observed: false,
      })),
      boundaries: {
        cc7r_source_lineage_revalidated: true,
        speaker_intent_never_forwarded_to_listener: true,
        subjective_projection_not_world_turn_end: true,
        technical_increment_end_not_turn_end: true,
        nomination_not_public_invitation: true,
        self_selection_requires_actual_world_action: true,
        actual_floor_awarded: false,
        public_invitation_emitted: false,
        world_action_replanned: false,
        fixed_gap_threshold_used: false,
      },
    },
    engine_private_admissions: {
      entries,
      next_speaker_selected: null,
      actual_floor_awarded: false,
      public_invitation_emitted: false,
      world_action_replanned: false,
    },
  });
}

export default buildWorldSimulationFloorTransitionAdmission;
