import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";
import { projectRoot } from "../server/src/project-paths.mjs";
import { beginWorldSimulationSession } from "../server/src/world-simulation-session-service.mjs";
import { prepareWorldSimulationTurn, runWorldSimulationTurn } from "../server/src/world-simulation-loop-service.mjs";
import { getWorldSimulationHistory } from "../server/src/world-simulation-state-service.mjs";
import { buildWorldSimulationCharacterBrainInput } from "../server/src/world-simulation-character-brain-input-service.mjs";

const fixtureRoot = path.join(projectRoot, "tests", ".tmp",
  `body1t-${process.pid}-${Date.now()}`);
const options = { fixtureRoot };
const odorId = "engine-only-flower-id";
const smell = { sense: "olfactory", kind: "detected_odor", perceptual_label: "花香" };
function world(x, enabled = true) {
  return {
    world_rules: { default_vision_range_m: 30 },
    simulation_time: "2026-09-28T00:00:00.000Z",
    characters: { Alice: { current_action: "observe" }, Bob: { current_action: "observe" } },
    objects: {},
    event_queue: [{ event_id: "smell-event", type: "observe", scene_id: "garden",
      participants: ["Alice", "Bob"] }],
    scenes: { garden: {
      scene_id: "garden", dimensions: { width_m: 20, depth_m: 20 },
      entity_positions: { Alice: { x, y: 0 }, Bob: { x: 6, y: 2 } },
      obstacles: [], lighting: { ambient_lux: 30 }, sound_events: [],
      olfactory_profiles: { Alice: { receptor_enabled: enabled, detection_threshold: 0.7 },
        Bob: { receptor_enabled: false } },
      odor_sources: [{ id: odorId, position: { x: 10, y: 0 },
        strength: 1, max_range_m: 8 }],
      olfactory_labels_by: { Alice: { [odorId]: "花香" } },
      observable_by: { Alice: { other_senses: [{
        sense: "olfactory", perceptual_label: "unverified-scene-odor",
      }, { sense: "tactile", kind: "hand_contact_detected" }] } },
    } },
    available_actions: { Alice: [{ action_id: "wait", intent: "Observe" }],
      Bob: [{ action_id: "wait", intent: "Observe" }] },
  };
}
function samples(prepared, character) {
  const packet = prepared.decision_packets.find((entry) => entry.character === character);
  assert.ok(packet);
  assert.equal(packet.perception.information_boundary.programmatic_olfaction_enforced, true);
  assert.equal(packet.boundaries.programmatic_olfaction_enforced, true);
  return packet.perception.other_senses;
}
try {
  const first = await beginWorldSimulationSession({
    simulation_label: "BODY-1T far", seed: "body1t-far",
    rules: { event_driven: true, persistent_causality: true },
    initial_world_state: world(0),
  }, options);
  const far = await prepareWorldSimulationTurn({
    world_simulation_session_id: first.world_simulation_session_id, event_id: "smell-event",
  }, options);
  assert.equal(far.olfaction_queries.length, 2);
  assert.equal(far.olfaction_queries[0].result.detected_count, 0);
  assert.equal(samples(far, "Alice").some((entry) => entry.sense === "olfactory"), false);
  assert.equal(samples(far, "Alice").some((entry) => entry.sense === "tactile"), true);
  assert.equal(samples(far, "Bob").some((entry) => entry.sense === "olfactory"), false);

  const nearWorld = world(6);
  const second = await beginWorldSimulationSession({
    simulation_label: "BODY-1T near", seed: "body1t-near",
    rules: { event_driven: true, persistent_causality: true },
    initial_world_state: nearWorld,
  }, options);
  const id = second.world_simulation_session_id;
  const near = await prepareWorldSimulationTurn({
    world_simulation_session_id: id, event_id: "smell-event",
  }, options);
  assert.equal(near.olfaction_queries[0].result.detected_count, 1);
  assert.deepEqual(samples(near, "Alice").filter((entry) => entry.sense === "olfactory"), [smell]);
  assert.equal(samples(near, "Bob").some((entry) => entry.sense === "olfactory"), false);
  const brain = buildWorldSimulationCharacterBrainInput(
    near.decision_packets.find((entry) => entry.character === "Alice"));
  assert.deepEqual(brain.perception.other_senses.filter((entry) => entry.sense === "olfactory"), [smell]);
  for (const view of [near.decision_packets, brain]) {
    const serialized = JSON.stringify(view);
    for (const forbidden of [odorId, "received_strength", "source_position", "unverified-scene-odor"]) {
      assert.equal(serialized.includes(forbidden), false, forbidden);
    }
  }
  const committed = await runWorldSimulationTurn({
    world_simulation_session_id: id, event_id: "smell-event",
  }, {
    ...options,
    characterBrain: async () => ({ action_id: "wait" }),
    causalAdjudicator: async (input) => {
      const next = structuredClone(input.world_state);
      next.event_queue = [];
      return { causal_resolution_id: "body1t-commit", next_world_state: next,
        action_outcomes: [], state_transitions: [], knowledge_transitions: [], scheduled_events: [] };
    },
  });
  assert.ok(committed);
  const history = await getWorldSimulationHistory(id, options);
  assert.equal(history.turns.length, 1);
  assert.equal(history.turns[0].olfaction_queries.length, 2);
  assert.equal(history.turns[0].olfaction_queries[0].result.detected_count, 1);
  assert.equal(history.turns[0].olfaction_queries[1].result.detected_count, 0);
} finally {
  assert.equal(path.dirname(fixtureRoot), path.join(projectRoot, "tests", ".tmp"));
  await rm(fixtureRoot, { recursive: true, force: true });
}
console.log("BODY-1T native olfactory turn admission tests passed.");
