import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";
import { projectRoot } from "../../server/src/project-paths.mjs";
import { beginWorldSimulationSession } from "../../server/src/world-simulation-session-service.mjs";
import { getWorldSimulationHistory, getWorldSimulationState } from "../../server/src/world-simulation-state-service.mjs";
import { readCommittedWorldSimulationObserverBodyOrientation } from "../../server/src/world-simulation-communication-body-orientation-observer-service.mjs";
import { buildWorldSimulationCharacterBrainInput } from "../../server/src/world-simulation-character-brain-input-service.mjs";
import { createWorldSimulationCharacterRuntimeManager, runWorldSimulationTurn } from "../../server/src/world-simulation-loop-service.mjs";

const fixtureRoot = path.join(projectRoot, "tests", ".tmp",
  `cc8m-${process.pid}-${Date.now()}`);
const options = { fixtureRoot };
const hiddenMeaning = "希望 B 留在房間";
try {
  const session = await beginWorldSimulationSession({
    simulation_label: "CC-8M body orientation Brain ingress",
    seed: "cc8m",
    rules: { event_driven: true, persistent_causality: true },
    initial_world_state: {
      simulation_time: "2026-09-29T00:00:00.000Z",
      world_rules: { communication_action_seconds: 0.3 },
      event_queue: [
        { event_id: "display", type: "interaction", scene_id: "room",
          participants: ["A", "B"] },
        { event_id: "observe", type: "interaction", scene_id: "room",
          participants: ["B"] },
      ],
      scenes: { room: {
        scene_id: "room", dimensions: { width_m: 8, depth_m: 8 },
        entity_positions: { A: { x: 1, y: 1 }, B: { x: 1, y: 4 } },
        entity_visual_detail_profiles: {
          A: { body_orientation_discernible: true,
            body_orientation_max_distance_m: 5 },
        },
      } },
      characters: {
        A: {
          facing_degrees: 0, body_facing_degrees: 0,
          physical_state: {}, known: [], current_goal: "向 B 示意",
          communication_goal: {
            character: "A", addressee: "B", purpose: "示意",
            mode: "nonverbal", nonverbal_signal: "以身體朝向示意",
            communication_context: { intentional_display: {
              intended_meaning: hiddenMeaning, modality: "body", target: "B",
            } },
          },
        },
        B: { facing_degrees: 270, body_facing_degrees: 270,
          physical_state: {}, known: [], current_goal: "留意周遭" },
      },
      objects: {}, memories: { A: [], B: [] },
      available_actions: { A: [], B: [] },
    },
  }, options);
  const id = session.world_simulation_session_id;
  const characterRuntimeManager = createWorldSimulationCharacterRuntimeManager({
    identityResolver: async (character) => ({
      entity_id: `character_${character.toLowerCase()}`,
      canonical_name: character,
      identity_source: "cc8m_test_identity", formal: true,
    }),
  });
  let actionId = null;
  const first = await runWorldSimulationTurn({
    world_simulation_session_id: id, event_id: "display",
  }, {
    ...options, characterRuntimeManager,
    characterBrain: async (packet) => {
      if (packet.character !== "A") return "reject_all";
      const candidate = packet.candidate_action_intents.find((item) =>
        item.communication?.embodied_display_request?.modality === "body");
      assert(candidate);
      actionId = candidate.action_id;
      return { action_id: actionId };
    },
  });
  assert.equal(first.committed, true);
  const history = await getWorldSimulationHistory(id, options);
  assert(history.turns[0].state_transitions.some((item) =>
    item.field === "body_facing_degrees" && item.source_action_id === actionId));
  const post = await getWorldSimulationState(id, options);
  const receipt = await readCommittedWorldSimulationObserverBodyOrientation({
    session_id: id, observer: "B", scene_id: "room",
    expected_revision: 1, expected_state_hash: post.state_hash,
  }, options);
  assert.equal(receipt.character_view.length, 1);
  const base = { character: "B", cognition: { perception: {} },
    candidate_action_intents: [], boundaries: {} };
  const forged = structuredClone(receipt);
  forged.character_view[0].source_action_id = actionId;
  assert.throws(() => buildWorldSimulationCharacterBrainInput(base, {
    observer_committed_body_orientation: forged,
  }), { code: "CC8M_BODY_ORIENTATION_BRAIN_INGRESS_INVALID" });

  let observerInput = null;
  const second = await runWorldSimulationTurn({
    world_simulation_session_id: id, event_id: "observe",
  }, {
    ...options, characterRuntimeManager,
    characterBrain: async (packet) => {
      assert.equal(packet.character, "B");
      observerInput = structuredClone(packet);
      return "reject_all";
    },
  });
  assert.equal(second.committed, true);
  assert(observerInput);
  assert.equal(observerInput.observed_body_orientation_cues.length, 1);
  assert.equal(Object.hasOwn(observerInput.cognition.perception,
    "observed_body_orientation_cues"), false);
  assert.equal(observerInput.boundaries
    .committed_body_orientation_early_cognition_duplicate_removed, true);
  assert.equal(observerInput.observed_body_orientation_cues[0].kind,
    "visible_body_orientation_change");
  assert.equal(observerInput.boundaries
    .committed_body_orientation_world_truth_authority, false);
  const serialized = JSON.stringify(observerInput);
  for (const hidden of [hiddenMeaning, actionId, "body_facing_degrees"]) {
    assert.equal(serialized.includes(hidden), false, hidden);
  }
  console.log("CC-8M committed body orientation Brain ingress tests passed.");
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
