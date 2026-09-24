import { hashAgentRunValue } from "./agent-run-service.mjs";
import {
  buildWorldSimulationFloorTransitionAdmission,
  worldSimulationFloorTransitionAdmissionVersion,
} from "./world-simulation-communication-floor-transition-admission-service.mjs";

export const worldSimulationPublicTurnInvitationVersion =
  "cc7t-selected-public-turn-invitation-v1";
const record = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const copy = (v) => JSON.parse(JSON.stringify(v ?? null));
const ref = (type, value) =>
  `${type}_${hashAgentRunValue({
    version: worldSimulationPublicTurnInvitationVersion, value,
  }).slice(0, 24)}`;
function fail(message) {
  const error = new Error(message);
  error.code = "CC7T_PUBLIC_TURN_INVITATION_INVALID";
  throw error;
}

/**
 * An invitation is a selected, realized PUBLIC speech act, not CC-7Q's
 * private intention or CC-7O's listener hypothesis. Revalidate CC-7S and
 * exact selected-action/outcome identity before recording an observable
 * acoustic invitation attempt. The observer still receives only its own
 * acoustic release through CC-7C/7D, never this World-private join.
 */
export function buildWorldSimulationPublicTurnInvitation({
  handoff, admissions, action_outcomes, speaker_intent_projection,
  selected_action_intents = [],
} = {}) {
  const transition = buildWorldSimulationFloorTransitionAdmission({
    handoff, admissions, action_outcomes, speaker_intent_projection,
  });
  if (transition.audit.schema_version !==
      worldSimulationFloorTransitionAdmissionVersion ||
      transition.audit.status !== "pretransition_evidence_only" ||
      !Array.isArray(selected_action_intents) ||
      selected_action_intents.length > 4096)
    fail("CC-7T requires bounded, revalidated CC-7S evidence.");
  const selected = new Map();
  for (const item of selected_action_intents) {
    const candidate = item?.candidate;
    if (candidate?.communication?.message?.speech_act !== "invite_next_turn")
      continue;
    const id = candidate?.action_id;
    if (typeof id !== "string" || !id || selected.has(id))
      fail("Selected invitation identity is missing or duplicated.");
    selected.set(id, { actor: item.character, candidate });
  }
  const emitted = new Map();
  for (const outcome of action_outcomes ?? []) {
    if (outcome?.communication_event?.speech_act !== "invite_next_turn")
      continue;
    const id = outcome.action_id;
    if (emitted.has(id)) fail("Duplicate public turn-invitation outcome.");
    const source = selected.get(id);
    const communication = source?.candidate?.communication;
    const message = communication?.message;
    const event = outcome.communication_event;
    if (outcome.result !== "communication_emitted" ||
        source?.actor !== outcome.actor || event.actor !== outcome.actor ||
        communication?.channel !== "speech" || event.channel !== "speech" ||
        message?.speech_act !== "invite_next_turn" ||
        communication.addressee !== event.addressee ||
        message.semantic_content !== event.semantic_content ||
        event.surface_realization_complete !== true ||
        event.surface_realization?.source_action_id !== id ||
        typeof event.surface_text !== "string" ||
        !event.surface_text.trim() ||
        event.surface_realization.surface_text !== event.surface_text ||
        !record(outcome.communication_acoustic_signal) ||
        outcome.communication_acoustic_signal.registered !== true ||
        outcome.communication_acoustic_signal.source_action_id !== id)
      fail("Public invitation must come from one selected emitted audible speech action.");
    emitted.set(id, outcome);
  }
  const nominations = new Map(
    speaker_intent_projection.engine_private_intentions
      .filter((intent) => intent.mode === "nominate_addressee")
      .map((intent) => [intent.source_action_id, intent]),
  );
  const signals = [];
  for (const entry of transition.engine_private_admissions.entries) {
    // A selected public invitation can be audible even if the recipient has
    // not requested the floor or has misunderstood the cue. CC-7S's listener
    // participation category cannot suppress the physical speech signal.
    const outcome = emitted.get(entry.source_action_id);
    if (!outcome) continue;
    const nomination = nominations.get(entry.source_action_id);
    if (!nomination) continue;
    if (outcome.communication_event.addressee !== entry.observer ||
        nomination.intended_next_speaker !== entry.observer ||
        nomination.intention_id !== entry.speaker_intent_id)
      fail("Public invitation target differs from the revalidated nomination.");
    const identity = {
      source_action_id: entry.source_action_id,
      source_projection_id: entry.source_projection_id,
      speaker_intent_id: entry.speaker_intent_id,
      observer: entry.observer,
    };
    signals.push({
      signal_id: ref("public_turn_invitation", identity),
      source_action_id: entry.source_action_id,
      observer: entry.observer,
      source_projection_id: entry.source_projection_id,
      speaker_intent_id: entry.speaker_intent_id,
      physical_speech_emitted: true,
      acoustic_cue_admitted: true,
      lexical_invitation_understood: false,
      actual_floor_awarded: false,
    });
  }
  return copy({
    audit: {
      schema_version: worldSimulationPublicTurnInvitationVersion,
      status: "public_invitation_signal_evidence_only",
      selected_public_invitation_source_count: emitted.size,
      audible_invitation_count: signals.length,
      entries: signals.map((signal) => ({
        signal_ref: signal.signal_id,
        source_ref: ref("world_source", signal.source_action_id),
        observer_ref: ref("observer", signal.observer),
        physical_speech_emitted: true,
        acoustic_cue_admitted: true,
        lexical_invitation_understood: false,
        actual_floor_awarded: false,
      })),
      boundaries: {
        cc7s_lineage_revalidated: true,
        selected_public_speech_act_required: true,
        private_nomination_alone_not_public: true,
        audible_cue_not_lexical_understanding: true,
        invitation_not_floor_award: true,
        hidden_speaker_intent_forwarded_to_listener: false,
        world_action_replanned: false,
        fixed_gap_threshold_used: false,
      },
    },
    engine_private_signals: {
      entries: signals,
      next_speaker_selected: null,
      actual_floor_awarded: false,
      world_action_replanned: false,
    },
  });
}

export default buildWorldSimulationPublicTurnInvitation;
