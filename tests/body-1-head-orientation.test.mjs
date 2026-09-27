import assert from "node:assert/strict";
import { hashAgentRunValue } from "../server/src/agent-run-service.mjs";
import { adjudicateWorldSimulationCausality } from "../server/src/world-simulation-causal-rule-engine.mjs";
import { queryWorldSimulationObserverDirectionalHeightVisibility } from "../server/src/world-simulation-directional-height-visibility-service.mjs";

const scene = {
  scene_id: "yard",
  dimensions: { width_m: 10, depth_m: 10 },
  entity_positions: { aria: { x: 2, y: 2 }, behind: { x: 0, y: 2 },
    front: { x: 4, y: 2 } },
  visibility_profiles: {
    aria: { facing_degrees: 0, horizontal_fov_degrees: 90 },
  },
  perception_labels_by: { aria: { behind: "背後的學生", front: "前方的學生" } },
};
const world = {
  simulation_time: "2026-09-27T09:00:00Z",
  event_queue: [{ event_id: "turn", scene_id: "yard", type: "observe",
    participants: ["aria"] }],
  world_rules: { default_vision_range_m: 10 },
  scenes: { yard: scene },
  characters: { aria: { physical_state: {} }, behind: {}, front: {} },
};
const observe = (state) => queryWorldSimulationObserverDirectionalHeightVisibility({
  world_state: state, scene_state: state.scenes.yard,
  scene_id: "yard", observer: "aria",
}).result;
const before = observe(world);
assert.equal(before.visible_entities.includes("front"), true);
assert.equal(before.visible_entities.includes("behind"), false);
const candidate = { action_id: "turn-head", motor_command: {
  type: "orient_head", facing_degrees: 180,
} };
const input = {
  world_simulation_session_id: "body1b-test", turn_id: "turn",
  world_state: world, world_state_hash: hashAgentRunValue(world),
  world_state_revision: 0, event: world.event_queue[0],
  selected_action_intents: [{ character: "aria", candidate }],
};
const result = await adjudicateWorldSimulationCausality(input);
assert.equal(result.action_outcomes.find((item) =>
  item.action_id === "turn-head")?.result, "head_orientation_completed");
assert.equal(result.next_world_state.characters.aria.facing_degrees, 180);
assert.equal(result.state_transitions.some((item) =>
  item.entity === "aria" && item.field === "facing_degrees"), true);
const after = observe(result.next_world_state);
assert.equal(after.visible_entities.includes("behind"), true);
assert.equal(after.visible_entities.includes("front"), false);
assert.equal(observe(world).visible_entities.includes("behind"), false);
assert.equal(hashAgentRunValue(world), input.world_state_hash);

for (const facing of ["180", -1, 360]) {
  const blocked = await adjudicateWorldSimulationCausality({
    ...input, selected_action_intents: [{ character: "aria",
      candidate: { action_id: "invalid", motor_command: {
        type: "orient_head", facing_degrees: facing,
      } } }],
  });
  assert.equal(blocked.action_outcomes.find((item) =>
    item.action_id === "invalid")?.result, "head_orientation_blocked");
  assert.equal(blocked.next_world_state.characters.aria.facing_degrees, undefined);
}
console.log("BODY-1B head orientation causal visual tests passed.");
