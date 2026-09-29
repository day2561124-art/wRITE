import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";
import { projectRoot } from "../../server/src/project-paths.mjs";
import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import { beginWorldSimulationSession } from "../../server/src/world-simulation-session-service.mjs";
import { commitWorldSimulationTurn, getWorldSimulationState } from "../../server/src/world-simulation-state-service.mjs";
import { buildCharacterCommunicationActionCandidate } from "../../server/src/character-communication-foundation-service.mjs";
import { adjudicateWorldSimulationCausality } from "../../server/src/world-simulation-causal-rule-engine.mjs";
import {
  buildWorldSimulationCommunicationOrientationObserverContract,
  projectWorldSimulationObserverCommittedOrientations,
  readCommittedWorldSimulationObserverOrientations,
} from "../../server/src/world-simulation-communication-orientation-observer-service.mjs";

function action(actor, modality, meaning) {
  return buildCharacterCommunicationActionCandidate({
    character: actor,
    cognition: { communication_goal: {
      character: actor, addressee: "B", purpose: "請 B 留意",
      mode: "nonverbal", nonverbal_signal: "以朝向示意",
      communication_context: { intentional_display: {
        intended_meaning: meaning, modality, target: "B",
      } },
    } },
  });
}
const gaze = action("A", "gaze", "私人的頭部意圖");
const body = action("C", "body", "私人的身體意圖");
const selected = [gaze, body].map((candidate) => ({
  character: candidate.actor ?? (candidate === gaze ? "A" : "C"),
  selection: "candidate_action_intent", candidate,
}));
const event = {
  event_id: "orientation", type: "interaction", scene_id: "room",
  participants: ["A", "B", "C"],
};
const initial = {
  simulation_time: "2026-09-29T00:00:00.000Z",
  world_rules: { communication_action_seconds: 0.25 },
  event_queue: [event],
  scenes: { room: {
    scene_id: "room", dimensions: { width_m: 10, depth_m: 10 },
    entity_positions: {
      A: { x: 1, y: 1 }, B: { x: 1, y: 4 }, C: { x: 4, y: 4 },
    },
    entity_visual_detail_profiles: {
      A: { head_orientation_discernible: true, head_orientation_max_distance_m: 5 },
      C: { body_orientation_discernible: true, body_orientation_max_distance_m: 5 },
    },
  } },
  characters: {
    A: { facing_degrees: 0, physical_state: {} },
    B: { facing_degrees: 270, body_facing_degrees: 270, physical_state: {} },
    C: { facing_degrees: 0, body_facing_degrees: 0, physical_state: {} },
  },
  objects: {},
};
const resolved = await adjudicateWorldSimulationCausality({
  world_simulation_session_id: "cc8l-test", turn_id: "orientation",
  world_state: initial, world_state_hash: hashAgentRunValue(initial),
  world_state_revision: 0, event, selected_action_intents: selected,
});
const state = resolved.next_world_state;
const turn = {
  turn_id: "orientation", event, revision_from: 0, revision_to: 1,
  previous_state_hash: hashAgentRunValue(initial),
  next_state_hash: hashAgentRunValue(state),
  selected_action_intents: selected,
  action_outcomes: resolved.action_outcomes,
  state_transitions: resolved.state_transitions,
};
const project = (post_world_state = state, committed_turn = turn) =>
  projectWorldSimulationObserverCommittedOrientations({
    post_world_state, committed_turn, observer: "B", scene_id: "room",
  });
const receipt = project();
assert.equal(receipt.admission_status, "visible_physical_cues_only");
assert.deepEqual(receipt.character_view.map((cue) => cue.kind), [
  "visible_head_orientation_change", "visible_body_orientation_change",
]);
assert.equal(receipt.audit.admitted_gaze_count, 1);
assert.equal(receipt.audit.admitted_body_count, 1);
assert.deepEqual(project(), receipt);
const exposed = JSON.stringify(receipt.character_view);
for (const secret of [gaze.action_id, body.action_id, "私人的頭部意圖", "私人的身體意圖", '"A"', '"C"', "90"]) {
  assert.equal(exposed.includes(secret), false, secret);
}
assert.equal(receipt.audit.boundaries.native_brain_ingress_performed, false);
assert.equal(buildWorldSimulationCommunicationOrientationObserverContract().cue_fusion_or_intent_inference, false);

const bodyHidden = structuredClone(state);
bodyHidden.scenes.room.entity_visual_detail_profiles.C.body_orientation_discernible = false;
const bodyHiddenTurn = { ...turn, next_state_hash: hashAgentRunValue(bodyHidden) };
assert.deepEqual(project(bodyHidden, bodyHiddenTurn).character_view.map((cue) => cue.kind),
  ["visible_head_orientation_change"]);
const bothHidden = structuredClone(bodyHidden);
bothHidden.scenes.room.entity_visual_detail_profiles.A.head_orientation_discernible = false;
assert.equal(project(bothHidden, { ...turn, next_state_hash: hashAgentRunValue(bothHidden) })
  .admission_status, "no_admitted_visual_cue");
const occluded = structuredClone(state);
occluded.scenes.room.visibility_blockers = [{
  id: "wall", x_min: 0.5, x_max: 4.5, y_min: 2, y_max: 3,
}];
assert.deepEqual(project(occluded, { ...turn, next_state_hash: hashAgentRunValue(occluded) })
  .character_view.map((cue) => cue.kind), ["visible_body_orientation_change"]);
assert.throws(() => project({ ...state, simulation_time: "tampered" }),
  /exact committed World revision/);

const fixtureRoot = path.join(projectRoot, "tests", ".tmp",
  `cc8l-${process.pid}-${Date.now()}`);
const options = { fixtureRoot };
try {
  const session = await beginWorldSimulationSession({
    simulation_label: "CC-8L convergence fixture", seed: "cc8l",
    rules: { event_driven: true, persistent_causality: true },
    initial_world_state: initial,
  }, options);
  const id = session.world_simulation_session_id;
  const first = await getWorldSimulationState(id, options);
  await commitWorldSimulationTurn(id, {
    expected_revision: 0, expected_state_hash: first.state_hash,
    turn_id: "orientation", next_world_state: state,
    selected_action_intents: selected, action_outcomes: turn.action_outcomes,
    state_transitions: turn.state_transitions, event,
  }, options);
  const committed = await readCommittedWorldSimulationObserverOrientations({
    session_id: id, observer: "B", scene_id: "room", expected_revision: 1,
  }, options);
  assert.deepEqual(committed, receipt);
  await assert.rejects(readCommittedWorldSimulationObserverOrientations({
    session_id: id, observer: "B", scene_id: "room", expected_state_hash: "forged",
  }, options), { code: "CC8L_ORIENTATION_OBSERVER_INVALID" });
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
console.log("CC-8L committed orientation convergence tests passed.");
