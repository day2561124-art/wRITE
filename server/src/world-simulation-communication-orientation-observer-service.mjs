import { hashAgentRunValue } from "./agent-run-service.mjs";
import { getWorldSimulationHistory, getWorldSimulationState } from "./world-simulation-state-service.mjs";
import {
  projectWorldSimulationObserverCommittedGaze,
  worldSimulationCommunicationGazeObserverVersion,
} from "./world-simulation-communication-gaze-observer-service.mjs";
import {
  projectWorldSimulationObserverCommittedBodyOrientation,
  worldSimulationCommunicationBodyOrientationObserverVersion,
} from "./world-simulation-communication-body-orientation-observer-service.mjs";

export const worldSimulationCommunicationOrientationObserverVersion =
  "cc8l-committed-orientation-observer-convergence-v1";

const record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const object = (value) => record(value) ? value : {};
const list = (value) => Array.isArray(value) ? value : [];
const copy = (value) => JSON.parse(JSON.stringify(value ?? null));

function fail(message) {
  const error = new Error(message);
  error.code = "CC8L_ORIENTATION_OBSERVER_INVALID";
  throw error;
}

export function buildWorldSimulationCommunicationOrientationObserverContract() {
  return {
    version: worldSimulationCommunicationOrientationObserverVersion,
    source: "one_exact_committed_world_turn_and_post_state",
    observer_scoped: true,
    gaze_source: worldSimulationCommunicationGazeObserverVersion,
    body_source: worldSimulationCommunicationBodyOrientationObserverVersion,
    physical_visual_cues_only: true,
    source_actor_or_action_ids_in_character_view: false,
    exact_orientation_or_target_in_character_view: false,
    cue_fusion_or_intent_inference: false,
    native_brain_ingress_performed: false,
    read_only: true,
  };
}

/** Collect independently gated visual cues against the SAME committed state. */
export function projectWorldSimulationObserverCommittedOrientations({
  committed_turn, post_world_state, observer, scene_id,
} = {}) {
  const turn = object(committed_turn);
  const state = object(post_world_state);
  if (!Number.isSafeInteger(turn.revision_to) || turn.revision_to < 1
      || typeof turn.next_state_hash !== "string"
      || turn.next_state_hash !== hashAgentRunValue(state))
    fail("One exact committed World revision and post-state are required.");
  const inputs = { committed_turn: turn, post_world_state: state, observer, scene_id };
  const gaze = projectWorldSimulationObserverCommittedGaze(inputs);
  const body = projectWorldSimulationObserverCommittedBodyOrientation(inputs);
  if (gaze.observer !== body.observer
      || gaze.audit?.source_revision_to !== body.audit?.source_revision_to
      || gaze.audit?.source_revision_to !== turn.revision_to
      || gaze.audit?.exact_post_state_verified !== true
      || body.audit?.exact_post_state_verified !== true)
    fail("Orientation source observer or committed revision mismatch.");
  const views = [...list(gaze.character_view), ...list(body.character_view)];
  if (views.length > 128 || new Set(views.map((cue) => cue.cue_ref)).size !== views.length)
    fail("Orientation cue count or lineage is invalid.");
  return copy({
    schema_version: worldSimulationCommunicationOrientationObserverVersion,
    observer: gaze.observer,
    admission_status: views.length ? "visible_physical_cues_only" : "no_admitted_visual_cue",
    character_view: views,
    audit: {
      source_revision_to: turn.revision_to,
      source_state_hash: turn.next_state_hash,
      gaze_candidate_count: list(gaze.audit?.candidates).length,
      body_candidate_count: list(body.audit?.candidates).length,
      admitted_gaze_count: gaze.character_view.length,
      admitted_body_count: body.character_view.length,
      boundaries: buildWorldSimulationCommunicationOrientationObserverContract(),
    },
  });
}

export async function readCommittedWorldSimulationObserverOrientations({
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
  return projectWorldSimulationObserverCommittedOrientations({
    committed_turn: last, post_world_state: first.state, observer, scene_id,
  });
}
