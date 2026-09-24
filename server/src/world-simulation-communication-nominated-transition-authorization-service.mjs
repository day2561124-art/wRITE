import { hashAgentRunValue } from "./agent-run-service.mjs";
import {
  buildWorldSimulationPublicInvitationUptake,
  worldSimulationPublicInvitationUptakeVersion,
} from "./world-simulation-communication-public-invitation-uptake-service.mjs";

export const worldSimulationNominatedTransitionAuthorizationVersion =
  "cc7v-nominated-public-transition-authorization-v1";

const copy = (value) => JSON.parse(JSON.stringify(value ?? null));
const ref = (type, value) =>
  `${type}_${hashAgentRunValue({
    version: worldSimulationNominatedTransitionAuthorizationVersion, value,
  }).slice(0, 24)}`;

function fail(message) {
  const error = new Error(message);
  error.code = "CC7V_NOMINATED_TRANSITION_INVALID";
  throw error;
}

/**
 * CC-7V is the first World-owned next-speaker selection boundary.
 *
 * It accepts only a public CC-7T invitation that CC-7U has already joined to
 * the SAME observer's latest subjective "selected me" floor request. This can
 * authorize who may receive the next conversational floor, but it deliberately
 * does not reopen the already-resolved World turn, emit the observer's reply,
 * classify overlap/interruption, or treat comprehension/grounding as true.
 *
 * Open-floor self-selection and multi-candidate arbitration remain separate
 * later work because their evidence and competition rules differ.
 */
export function buildWorldSimulationNominatedTransitionAuthorization({
  handoff,
  admissions,
  action_outcomes,
  speaker_intent_projection,
  selected_action_intents = [],
} = {}) {
  const uptake = buildWorldSimulationPublicInvitationUptake({
    handoff,
    admissions,
    action_outcomes,
    speaker_intent_projection,
    selected_action_intents,
  });
  if (uptake.audit?.schema_version !==
      worldSimulationPublicInvitationUptakeVersion ||
      uptake.audit?.status !== "public_and_subjective_evidence_join_only" ||
      !Array.isArray(uptake.audit.entries) ||
      !Array.isArray(uptake.engine_private_evidence?.entries) ||
      uptake.audit.entries.length !== uptake.engine_private_evidence.entries.length ||
      uptake.engine_private_evidence.actual_floor_awarded !== false ||
      uptake.engine_private_evidence.next_speaker_selected !== null ||
      uptake.engine_private_evidence.world_action_replanned !== false)
    fail("CC-7V requires canonical noncommittal CC-7U evidence.");

  const privateEntries = uptake.engine_private_evidence.entries;
  if (privateEntries.length > 4096)
    fail("CC-7V requires bounded invitation evidence.");

  const auditBySignal = new Map();
  for (const entry of uptake.audit.entries) {
    if (typeof entry?.signal_ref !== "string" || !entry.signal_ref ||
        auditBySignal.has(entry.signal_ref))
      fail("CC-7U public signal audit identity is missing or duplicated.");
    auditBySignal.set(entry.signal_ref, entry);
  }

  const candidates = [];
  for (const entry of privateEntries) {
    const audit = auditBySignal.get(entry?.public_signal_id);
    if (!audit ||
        audit.release_time_ms !== entry.release_time_ms ||
        audit.target_relation !== entry.target_relation ||
        audit.subjective_selection !== entry.subjective_selection ||
        audit.subjective_readiness !== entry.subjective_readiness ||
        audit.evidence_relation !== entry.evidence_relation ||
        audit.actual_floor_awarded !== false)
      fail("CC-7U private and persisted invitation evidence disagree.");

    const candidate =
      entry.target_relation === "nominated_observer" &&
      entry.subjective_selection === "selected_me" &&
      entry.subjective_readiness === "subjective_selected_me_request" &&
      entry.evidence_relation ===
        "public_invitation_and_subjective_request_coincide";
    if (!candidate) continue;

    if (typeof entry.observer !== "string" || !entry.observer.trim() ||
        typeof entry.source_action_id !== "string" ||
        !entry.source_action_id.trim() ||
        typeof entry.source_projection_id !== "string" ||
        !entry.source_projection_id.trim() ||
        typeof entry.participation_intent_id !== "string" ||
        !entry.participation_intent_id.trim() ||
        typeof entry.response_plan_ref !== "string" ||
        !entry.response_plan_ref.trim())
      fail("Convergent nominated transition evidence is incomplete.");

    candidates.push(entry);
  }

  let selected = null;
  let status = "no_nominated_transition_authorized";
  if (candidates.length === 1) {
    selected = candidates[0];
    status = "nominated_future_transition_authorized";
  } else if (candidates.length > 1) {
    status = "multiple_nominated_transitions_deferred";
  }

  const authorizationId = selected
    ? ref("nominated_transition", {
      source_action_id: selected.source_action_id,
      observer: selected.observer,
      source_projection_id: selected.source_projection_id,
      participation_intent_id: selected.participation_intent_id,
      release_time_ms: selected.release_time_ms,
    })
    : null;

  return copy({
    audit: {
      schema_version: worldSimulationNominatedTransitionAuthorizationVersion,
      status,
      convergent_nomination_candidate_count: candidates.length,
      next_speaker_selected: selected !== null,
      selected_transition: selected
        ? {
          authorization_ref: authorizationId,
          source_ref: ref("source", selected.source_action_id),
          observer_ref: ref("observer", selected.observer),
          public_signal_ref: selected.public_signal_id,
          release_time_ms: selected.release_time_ms,
          authorization: "future_nominated_turn_selected",
          actual_floor_awarded: false,
          response_emitted: false,
        }
        : null,
      boundaries: {
        cc7u_public_and_subjective_evidence_revalidated: true,
        exactly_one_convergent_nomination_required: true,
        observer_floor_request_required: true,
        public_invitation_alone_does_not_select: true,
        subjective_selected_me_alone_does_not_select: true,
        open_floor_self_selection_deferred: true,
        multi_candidate_arbitration_deferred: true,
        current_turn_world_action_replanned: false,
        actual_floor_awarded: false,
        response_emitted: false,
        grounding_or_belief_changed: false,
        overlap_or_interruption_judged: false,
        fixed_gap_threshold_used: false,
      },
    },
    engine_private_authorization: {
      authorization_id: authorizationId,
      next_speaker_selected: selected?.observer ?? null,
      response_plan_ref: selected?.response_plan_ref ?? null,
      source_action_id: selected?.source_action_id ?? null,
      source_projection_id: selected?.source_projection_id ?? null,
      participation_intent_id: selected?.participation_intent_id ?? null,
      release_time_ms: selected?.release_time_ms ?? null,
      future_turn_execution_required: selected !== null,
      actual_floor_awarded: false,
      response_emitted: false,
      world_action_replanned: false,
    },
  });
}

export default buildWorldSimulationNominatedTransitionAuthorization;
