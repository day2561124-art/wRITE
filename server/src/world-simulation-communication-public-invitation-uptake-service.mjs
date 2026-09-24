import { hashAgentRunValue } from "./agent-run-service.mjs";
import {
  buildWorldSimulationPublicTurnInvitation,
  worldSimulationPublicTurnInvitationVersion,
} from "./world-simulation-communication-public-turn-invitation-service.mjs";
import {
  buildWorldSimulationSourceLineageReconciliation,
  worldSimulationSourceLineageReconciliationVersion,
} from "./world-simulation-communication-source-lineage-reconciliation-service.mjs";

export const worldSimulationPublicInvitationUptakeVersion =
  "cc7u-public-invitation-observer-evidence-join-v1";
const copy = (value) => JSON.parse(JSON.stringify(value ?? null));
const key = (...values) => JSON.stringify(values);
const ref = (type, value) =>
  `${type}_${hashAgentRunValue({
    version: worldSimulationPublicInvitationUptakeVersion, value,
  }).slice(0, 24)}`;
function fail(message) {
  const error = new Error(message);
  error.code = "CC7U_INVITATION_UPTAKE_INVALID";
  throw error;
}

/**
 * Join a physical public invitation with this observer's own latest
 * post-release projection. A projected selection can be mistaken; even a
 * matching request is evidence for a future transition, never a floor award.
 * The CC-7T and CC-7R builders revalidate source, sound, and observer lineage.
 */
export function buildWorldSimulationPublicInvitationUptake({
  handoff, admissions, action_outcomes, speaker_intent_projection,
  selected_action_intents = [],
} = {}) {
  const inputs = { handoff, admissions, action_outcomes, speaker_intent_projection };
  const publicInvitation = buildWorldSimulationPublicTurnInvitation({
    ...inputs, selected_action_intents,
  });
  const reconciled = buildWorldSimulationSourceLineageReconciliation(inputs);
  if (publicInvitation.audit.schema_version !==
      worldSimulationPublicTurnInvitationVersion ||
      publicInvitation.audit.status !== "public_invitation_signal_evidence_only" ||
      reconciled.audit.schema_version !==
      worldSimulationSourceLineageReconciliationVersion ||
      reconciled.audit.status !== "world_source_lineage_evidence_only")
    fail("CC-7U requires canonical revalidated World evidence.");
  const latestAcoustic = new Map();
  for (const admission of admissions ?? []) {
    if (admission?.admission_status !== "heard_acoustic_cues_only") continue;
    const group = key(admission.audit.source_action_id, admission.observer);
    const previous = latestAcoustic.get(group);
    if (!previous || admission.release_time_ms > previous)
      latestAcoustic.set(group, admission.release_time_ms);
  }
  const latestProjection = new Map();
  for (const entry of reconciled.engine_private_world_evidence.joined_observer_sources) {
    const group = key(entry.source_action_id, entry.observer);
    if (latestProjection.has(group))
      fail("One source and observer cannot have two latest projections.");
    latestProjection.set(group, entry);
  }
  const intentions = new Map(speaker_intent_projection.engine_private_intentions
    .map((item) => [item.intention_id, item]));
  const projectionById = new Map();
  for (const item of handoff?.projections ?? []) {
    const projectionId = item?.projection?.projection_id;
    if (typeof projectionId !== "string" || !projectionId) continue;
    if (projectionById.has(projectionId))
      fail("One projection identity cannot appear twice.");
    projectionById.set(projectionId, item);
  }
  const entries = [];
  const privateEntries = [];
  for (const signal of publicInvitation.engine_private_signals.entries) {
    const group = key(signal.source_action_id, signal.observer);
    const released = latestAcoustic.get(group);
    const intention = intentions.get(signal.speaker_intent_id);
    if (released === undefined || !intention ||
        intention.source_action_id !== signal.source_action_id)
      fail("Public signal has no matching physical release or speaker source.");
    const projection = latestProjection.get(group) ?? null;
    if (projection && projection.release_time_ms > released)
      fail("Observer projection cannot precede its physical source release.");
    const current = projection?.release_time_ms === released;
    const selection = current
      ? projection.listener_selection_status : "no_current_projection";
    const readiness = current
      ? projection.listener_mode : "no_current_projection";
    const targetRelation = intention.intended_next_speaker === signal.observer
      ? "nominated_observer" : "overheard_other_nomination";
    let relation = "no_current_projection";
    if (current) {
      if (selection === "selected_me" &&
          targetRelation === "overheard_other_nomination")
        relation = "subjective_selection_conflicts_with_source";
      else if (targetRelation === "nominated_observer" &&
               readiness === "subjective_selected_me_request")
        relation = "public_invitation_and_subjective_request_coincide";
      else relation = "independent_subjective_evidence";
    }
    const handoffEntry = current
      ? projectionById.get(projection.source_projection_id) ?? null
      : null;
    if (current && !handoffEntry)
      fail("Current observer projection is missing its CC-7D handoff entry.");
    const participation = handoffEntry?.participation_intent ?? null;
    entries.push({
      observer_ref: ref("observer", signal.observer),
      source_ref: ref("source", signal.source_action_id),
      signal_ref: signal.signal_id,
      release_time_ms: released,
      target_relation: targetRelation,
      subjective_selection: selection,
      subjective_readiness: readiness,
      evidence_relation: relation,
      lexical_invitation_understood: false,
      actual_floor_awarded: false,
    });
    privateEntries.push({
      observer: signal.observer,
      source_action_id: signal.source_action_id,
      public_signal_id: signal.signal_id,
      speaker_intent_id: signal.speaker_intent_id,
      source_projection_id: current ? projection.source_projection_id : null,
      participation_intent_id: current
        ? participation?.intention_id ?? null : null,
      response_plan_ref: current
        ? participation?.response_plan_ref ?? null : null,
      release_time_ms: released,
      target_relation: targetRelation,
      subjective_selection: selection,
      subjective_readiness: readiness,
      evidence_relation: relation,
    });
  }
  return copy({
    audit: {
      schema_version: worldSimulationPublicInvitationUptakeVersion,
      status: "public_and_subjective_evidence_join_only",
      audible_invitation_count: entries.length,
      current_observer_projection_count: entries.filter((entry) =>
        entry.subjective_selection !== "no_current_projection").length,
      convergent_request_count: entries.filter((entry) =>
        entry.evidence_relation ===
        "public_invitation_and_subjective_request_coincide").length,
      entries,
      boundaries: {
        cc7t_public_signal_revalidated: true,
        cc7r_world_source_lineage_revalidated: true,
        subjective_selection_not_speaker_intent: true,
        acoustic_cue_not_lexical_understanding: true,
        public_invitation_not_floor_award: true,
        stale_projection_not_current_evidence: true,
        hidden_speaker_intent_forwarded_to_listener: false,
        world_action_replanned: false,
        fixed_gap_threshold_used: false,
      },
    },
    engine_private_evidence: {
      entries: privateEntries,
      actual_floor_awarded: false,
      next_speaker_selected: null,
      world_action_replanned: false,
    },
  });
}

export default buildWorldSimulationPublicInvitationUptake;
