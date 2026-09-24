import { hashAgentRunValue } from "./agent-run-service.mjs";
import {
  buildWorldSimulationFloorTransitionAdmission,
  worldSimulationFloorTransitionAdmissionVersion,
} from "./world-simulation-communication-floor-transition-admission-service.mjs";

export const worldSimulationOpenFloorTransitionAuthorizationVersion =
  "cc7w-open-floor-self-selection-authorization-v1";

const copy = (value) => JSON.parse(JSON.stringify(value ?? null));
const ref = (type, value) =>
  `${type}_${hashAgentRunValue({
    version: worldSimulationOpenFloorTransitionAuthorizationVersion,
    value,
  }).slice(0, 24)}`;

function fail(message) {
  const error = new Error(message);
  error.code = "CC7W_OPEN_FLOOR_TRANSITION_INVALID";
  throw error;
}

function nonblank(value) {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Authorize one future open-floor self-selection without inventing a winner.
 *
 * CC-7S already revalidates the actual World speech source, the speaker's
 * explicit yield_open_floor intention, and the listener's current subjective
 * floor request. CC-7W adds only the narrow World selection boundary:
 * exactly one current self-selection candidate may be selected for a future
 * turn. Two or more candidates remain unresolved; arrival time and array order
 * are never tie-breakers.
 *
 * This does not emit the response, award a currently-active floor, classify
 * overlap/interruption, or reopen the already resolved World action set.
 */
export function buildWorldSimulationOpenFloorTransitionAuthorization({
  handoff,
  admissions,
  action_outcomes,
  speaker_intent_projection,
} = {}) {
  const transition = buildWorldSimulationFloorTransitionAdmission({
    handoff,
    admissions,
    action_outcomes,
    speaker_intent_projection,
  });
  if (transition.audit?.schema_version !==
      worldSimulationFloorTransitionAdmissionVersion ||
      transition.audit?.status !== "pretransition_evidence_only" ||
      !Array.isArray(transition.engine_private_admissions?.entries) ||
      transition.engine_private_admissions.actual_floor_awarded !== false ||
      transition.engine_private_admissions.next_speaker_selected !== null ||
      transition.engine_private_admissions.public_invitation_emitted !== false ||
      transition.engine_private_admissions.world_action_replanned !== false)
    fail("CC-7W requires canonical noncommittal CC-7S evidence.");

  if (!Array.isArray(handoff?.projections) || handoff.projections.length > 4096)
    fail("CC-7W requires bounded canonical CC-7D projections.");

  const handoffByProjection = new Map();
  for (const item of handoff.projections) {
    const projectionId = item?.projection?.projection_id;
    if (!nonblank(projectionId) || handoffByProjection.has(projectionId))
      fail("CC-7D projection identity is missing or duplicated.");
    handoffByProjection.set(projectionId, item);
  }

  const candidates = [];
  for (const entry of transition.engine_private_admissions.entries) {
    if (entry?.admission !== "self_selection_pending_world_action")
      continue;
    const item = handoffByProjection.get(entry.source_projection_id);
    const participation = item?.participation_intent ?? null;
    if (!item ||
        item.observer !== entry.observer ||
        participation?.mode !== "request_floor" ||
        participation.source_projection_id !== entry.source_projection_id ||
        !nonblank(participation.intention_id) ||
        !nonblank(participation.response_plan_ref))
      fail("Open-floor candidate lacks its current observer floor request.");
    candidates.push({
      observer: entry.observer,
      source_action_id: entry.source_action_id,
      source_projection_id: entry.source_projection_id,
      speaker_intent_id: entry.speaker_intent_id,
      participation_intent_id: participation.intention_id,
      response_plan_ref: participation.response_plan_ref,
      release_time_ms: item.release_time_ms,
    });
  }

  let selected = null;
  let status = "no_open_floor_transition_authorized";
  if (candidates.length === 1) {
    selected = candidates[0];
    status = "open_floor_future_transition_authorized";
  } else if (candidates.length > 1) {
    status = "open_floor_competition_deferred";
  }

  const authorizationId = selected
    ? ref("open_floor_transition", {
      observer: selected.observer,
      source_action_id: selected.source_action_id,
      source_projection_id: selected.source_projection_id,
      participation_intent_id: selected.participation_intent_id,
      release_time_ms: selected.release_time_ms,
    })
    : null;

  return copy({
    audit: {
      schema_version: worldSimulationOpenFloorTransitionAuthorizationVersion,
      status,
      self_selection_candidate_count: candidates.length,
      distinct_candidate_observer_count:
        new Set(candidates.map((entry) => entry.observer)).size,
      next_speaker_selected: selected !== null,
      selected_transition: selected
        ? {
          authorization_ref: authorizationId,
          source_ref: ref("source", selected.source_action_id),
          observer_ref: ref("observer", selected.observer),
          release_time_ms: selected.release_time_ms,
          authorization: "future_open_floor_self_selection",
          actual_floor_awarded: false,
          response_emitted: false,
        }
        : null,
      boundaries: {
        cc7s_world_transition_evidence_revalidated: true,
        explicit_speaker_open_floor_intent_required: true,
        current_observer_floor_request_required: true,
        exactly_one_candidate_required: true,
        arrival_order_is_not_priority: true,
        same_release_time_is_not_tie_breaker: true,
        competition_requires_later_arbitration: true,
        backchannel_is_not_self_selection: true,
        selected_other_conflict_is_not_authorized: true,
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
      speaker_intent_id: selected?.speaker_intent_id ?? null,
      release_time_ms: selected?.release_time_ms ?? null,
      future_turn_execution_required: selected !== null,
      actual_floor_awarded: false,
      response_emitted: false,
      world_action_replanned: false,
    },
  });
}

export default buildWorldSimulationOpenFloorTransitionAuthorization;
