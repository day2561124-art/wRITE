import assert from "node:assert/strict";

import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import { buildCharacterCommunicationActionCandidate } from "../../server/src/character-communication-foundation-service.mjs";
import { adjudicateWorldSimulationCausality } from "../../server/src/world-simulation-causal-rule-engine.mjs";

function candidate({ modality = "body", target = "B", display = true } = {}) {
  return buildCharacterCommunicationActionCandidate({
    character: "A",
    cognition: { communication_goal: {
      character: "A", purpose: "請 B 暫停", addressee: "B",
      mode: "direct", public_content: "請先等一下",
      ...(display ? { communication_context: { intentional_display: {
        intended_meaning: "不希望 B 現在離開", modality, target,
      } } } : {}),
    } },
  });
}

function world({ unconscious = false, targetPosition = { x: 1, y: 4 } } = {}) {
  return {
    simulation_time: "2026-09-29T00:00:00.000Z",
    world_rules: { communication_action_seconds: 0.25 },
    event_queue: [{ event_id: "cc8j-turn", type: "interaction",
      scene_id: "room", participants: ["A", "B"] }],
    scenes: { room: { scene_id: "room",
      dimensions: { width_m: 8, depth_m: 8 },
      entity_positions: { A: { x: 1, y: 1 },
        ...(targetPosition ? { B: targetPosition } : {}) },
    } },
    characters: {
      A: { facing_degrees: 0, body_facing_degrees: 0,
        physical_state: { unconscious } },
      B: { physical_state: {} },
    },
    objects: {},
  };
}

async function adjudicate(state, action) {
  return adjudicateWorldSimulationCausality({
    world_simulation_session_id: "cc8j-test", turn_id: "cc8j-turn",
    world_state: state, world_state_hash: hashAgentRunValue(state),
    world_state_revision: 0, event: state.event_queue[0],
    selected_action_intents: [{ character: "A",
      selection: "candidate_action_intent", candidate: action }],
  });
}

{
  const action = candidate();
  assert.deepEqual(action.communication.embodied_display_request, {
    schema_version: "cc8a-embodied-display-request-v1",
    modality: "body", target_relation: "addressee",
  });
  assert.equal(JSON.stringify(action).includes("不希望 B 現在離開"), false);
  const initial = world();
  const result = await adjudicate(initial, action);
  const outcome = result.action_outcomes.find((item) => item.action_id === action.action_id);
  assert.equal(outcome?.result, "communication_emitted");
  assert.equal(result.next_world_state.characters.A.body_facing_degrees, 90);
  assert.equal(result.next_world_state.characters.A.facing_degrees, 0);
  assert.equal(result.state_transitions.some((item) =>
    item.entity === "A" && item.field === "body_facing_degrees"
    && item.from === 0 && item.to === 90
    && item.source_action_id === action.action_id), true);
  assert.deepEqual(outcome.communication_event.embodied_display, {
    schema_version: "cc8a-embodied-display-realization-v1",
    modality: "body", target_relation: "addressee",
    effector: "body_orientation", realized: true,
    source_action_id: action.action_id,
    private_intended_meaning_exposed: false,
    objective_target_coordinates_exposed: false,
  });
  assert.equal(JSON.stringify(outcome.communication_event).includes("不希望 B 現在離開"), false);
  assert.equal(initial.characters.A.body_facing_degrees, 0);
}

{
  const action = candidate({ display: false });
  assert.equal(Object.hasOwn(action.communication, "embodied_display_request"), false);
  const result = await adjudicate(world(), action);
  assert.equal(result.next_world_state.characters.A.body_facing_degrees, 0);
  assert.equal(result.action_outcomes[0].communication_event?.embodied_display, undefined);
}

for (const state of [world({ unconscious: true }), world({ targetPosition: null })]) {
  const action = candidate();
  const result = await adjudicate(state, action);
  assert.equal(result.action_outcomes[0].result, "blocked");
  assert.equal(result.next_world_state.characters.A.body_facing_degrees, 0);
}

for (const action of [candidate({ target: "C" }), candidate({ modality: "gesture" })]) {
  assert.equal(Object.hasOwn(action.communication, "embodied_display_request"), false);
}
{
  const action = candidate({ display: false });
  action.communication.embodied_display_request = {
    schema_version: "cc8a-embodied-display-request-v1",
    modality: "body", target_relation: "addressee",
  };
  const result = await adjudicate(world(), action);
  assert.equal(result.action_outcomes[0].result, "blocked");
  assert.equal(result.next_world_state.characters.A.body_facing_degrees, 0);
}

console.log("CC-8J body orientation display tests passed.");
