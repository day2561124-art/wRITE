import { hashAgentRunValue } from "./agent-run-service.mjs";
import { queryWorldSimulationObserverIlluminationVisibility } from "./world-simulation-illumination-visibility-service.mjs";
import { getWorldSimulationHistory, getWorldSimulationState } from "./world-simulation-state-service.mjs";

export const worldSimulationCommunicationGazeObserverVersion =
  "cc8b-committed-gaze-observer-cue-v1";

const record = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const object = (v) => record(v) ? v : {};
const list = (v) => Array.isArray(v) ? v : [];
const copy = (v) => JSON.parse(JSON.stringify(v ?? null));

function fail(reason) {
  const error = new Error(reason);
  error.code = "CC8B_GAZE_OBSERVER_INVALID";
  throw error;
}
function name(value, label) {
  if (typeof value !== "string" || !value.trim() || [...value].length > 240)
    fail(label + " requires bounded nonblank text.");
  return value.trim();
}
function point(value) {
  const x = value?.x;
  const y = value?.y;
  return typeof x === "number" && Number.isFinite(x)
    && typeof y === "number" && Number.isFinite(y) ? { x, y } : null;
}

export function buildWorldSimulationCommunicationGazeObserverContract() {
  return {
    version: worldSimulationCommunicationGazeObserverVersion,
    source: "exact_committed_world_turn_and_post_state",
    read_only: true,
    committed_head_change_required: true,
    clear_observer_visibility_required: true,
    explicit_head_detail_and_range_required: true,
    character_view_contains_engine_actor_or_action_id: false,
    character_view_contains_exact_orientation_or_target: false,
    communicative_intent_or_identity_inferred: false,
    native_brain_ingress_performed: false,
  };
}

/**
 * A committed head turn is only a candidate physical signal. The observer
 * receives a cue when the exact post-action state remains visible in clear
 * light and the scene explicitly supports discerning head detail at range.
 * This does not attest attention, identity, gaze target, or interpretation.
 */
export function projectWorldSimulationObserverCommittedGaze({
  committed_turn, post_world_state, observer, scene_id,
} = {}) {
  const listener = name(observer, "observer");
  const sceneId = name(scene_id, "scene_id");
  const turn = object(committed_turn);
  const state = object(post_world_state);
  if (!Number.isSafeInteger(turn.revision_to) || turn.revision_to < 1
      || typeof turn.next_state_hash !== "string"
      || turn.next_state_hash !== hashAgentRunValue(state))
    fail("Exact committed post-action World revision and hash are required.");
  const scene = object(object(state.scenes)[sceneId]);
  if (!Object.keys(scene).length || (scene.scene_id != null && scene.scene_id !== sceneId)
      || (turn.event?.scene_id != null && turn.event.scene_id !== sceneId))
    fail("Observer and committed action must share the exact scene.");

  const views = [];
  const audits = [];
  for (const outcome of list(turn.action_outcomes)) {
    const event = object(outcome?.communication_event);
    const display = object(event.embodied_display);
    if (outcome?.result !== "communication_emitted"
        || display.schema_version !== "cc8a-embodied-display-realization-v1"
        || display.modality !== "gaze" || display.realized !== true)
      continue;
    const actor = name(outcome.actor, "source actor");
    const actionId = name(outcome.action_id, "source action_id");
    if (actor === listener) continue;
    if (!Object.hasOwn(object(state.characters), actor)
        || !Object.hasOwn(object(state.characters), listener)
        || typeof object(state.characters[actor]).facing_degrees !== "number"
        || !Number.isFinite(state.characters[actor].facing_degrees))
      fail("Both observer and source require committed character state.");
    const selections = list(turn.selected_action_intents).filter((item) =>
      item?.character === actor && item?.candidate?.action_id === actionId
      && item.selection === "candidate_action_intent"
      && item.candidate?.communication?.embodied_display_request?.schema_version
        === "cc8a-embodied-display-request-v1");
    const transitions = list(turn.state_transitions).filter((item) =>
      item?.entity === actor && item?.field === "facing_degrees"
      && item.source_action_id === actionId);
    if (selections.length !== 1 || transitions.length !== 1
        || event.actor !== actor || display.source_action_id !== actionId
        || event.channel !== "nonverbal"
        || display.target_relation !== "addressee"
        || display.private_intended_meaning_exposed !== false
        || display.objective_target_coordinates_exposed !== false
        || event.addressee !== selections[0].candidate.communication.addressee
        || event.addressee !== selections[0].candidate.target
        || display.effector !== "head_orientation"
        || transitions[0].from === transitions[0].to
        || transitions[0].to !== object(object(state.characters)[actor]).facing_degrees)
      fail("Gaze cue requires one action-linked committed head change.");
    const physical = object(object(object(state.characters)[listener]).physical_state);
    const detail = object(object(scene.entity_visual_detail_profiles)[actor]);
    const maxRange = detail.head_orientation_max_distance_m;
    const from = point(object(scene.entity_positions)[listener]);
    const to = point(object(scene.entity_positions)[actor]);
    const distance = from && to ? Math.hypot(to.x - from.x, to.y - from.y) : Infinity;
    const query = queryWorldSimulationObserverIlluminationVisibility({
      world_state: state, scene_state: scene, scene_id: sceneId, observer: listener,
    });
    const clear = list(query.result.clear_entities).includes(actor);
    const admitted = physical.unconscious !== true && physical.incapacitated !== true
      && detail.head_orientation_discernible === true
      && typeof maxRange === "number" && Number.isFinite(maxRange) && maxRange > 0
      && distance <= maxRange && clear;
    audits.push({
      source_actor: actor, source_action_id: actionId, observer: listener,
      source_revision_to: turn.revision_to,
      visibility_query_hash: query.audit.result_hash,
      clear_visibility: clear, head_detail_configured: detail.head_orientation_discernible === true,
      within_explicit_detail_range: Number.isFinite(distance) && distance <= maxRange,
      admitted,
    });
    if (admitted) views.push({
      schema_version: worldSimulationCommunicationGazeObserverVersion,
      kind: "visible_head_orientation_change",
      sense: "visual",
      observer: listener,
      cue_ref: "gaze_cue_" + hashAgentRunValue({
        version: worldSimulationCommunicationGazeObserverVersion,
        observer: listener, action_id: actionId, revision: turn.revision_to,
      }).slice(0, 24),
      actor_identity_recognized: false,
      exact_orientation_exposed: false,
      gaze_target_inferred: false,
      communicative_intent_inferred: false,
      interpretation: null,
      world_truth_claimed: false,
    });
  }
  return copy({
    schema_version: worldSimulationCommunicationGazeObserverVersion,
    observer: listener,
    admission_status: views.length ? "visible_physical_cue_only" : "no_admitted_visual_cue",
    character_view: views,
    audit: {
      exact_post_state_verified: true,
      source_turn_id: turn.turn_id ?? null,
      source_revision_to: turn.revision_to,
      candidates: audits,
      boundaries: buildWorldSimulationCommunicationGazeObserverContract(),
    },
  });
}

/** Bind the projector to one authoritative persisted World revision. */
export async function readCommittedWorldSimulationObserverGaze({
  session_id, observer, scene_id, expected_revision, expected_state_hash,
} = {}, options = {}) {
  const first = await getWorldSimulationState(session_id, options);
  if (expected_revision !== undefined && expected_revision !== first.revision)
    fail("Committed World revision changed.");
  if (expected_state_hash !== undefined && expected_state_hash !== first.state_hash)
    fail("Committed World state hash changed.");
  const history = await getWorldSimulationHistory(session_id, options);
  const second = await getWorldSimulationState(session_id, options);
  if (first.revision !== second.revision || first.state_hash !== second.state_hash)
    fail("Committed World snapshot changed during observer projection.");
  const last = list(history.turns).at(-1);
  if (!last || last.revision_to !== first.revision
      || last.next_state_hash !== first.state_hash
      || hashAgentRunValue(first.state) !== first.state_hash)
    fail("Committed World history and state do not match.");
  return projectWorldSimulationObserverCommittedGaze({
    committed_turn: last, post_world_state: first.state, observer, scene_id,
  });
}
