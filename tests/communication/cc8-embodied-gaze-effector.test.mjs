import assert from "node:assert/strict";

import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import { buildCharacterCommunicationActionCandidate } from "../../server/src/character-communication-foundation-service.mjs";
import { adjudicateWorldSimulationCausality } from "../../server/src/world-simulation-causal-rule-engine.mjs";
import { queryWorldSimulationObserverDirectionalHeightVisibility } from "../../server/src/world-simulation-directional-height-visibility-service.mjs";

function candidate({ display = true, mode = "nonverbal", signal = "以視線示意 B 暫停" } = {}) {
  return buildCharacterCommunicationActionCandidate({
    character: "A",
    cognition: {
      communication_goal: {
        character: "A",
        purpose: "請 B 暫停",
        addressee: "B",
        mode,
        ...(mode === "nonverbal"
          ? { nonverbal_signal: signal }
          : { public_content: "請先等一下" }),
        ...(display ? {
          communication_context: {
            intentional_display: {
              intended_meaning: "不希望 B 現在離開",
              modality: "gaze",
              target: "B",
            },
          },
        } : {}),
      },
    },
  });
}

function world({ unconscious = false, targetPosition = { x: 1, y: 4 } } = {}) {
  return {
    simulation_time: "2026-09-29T00:00:00.000Z",
    world_rules: { communication_action_seconds: 0.25 },
    event_queue: [{
      event_id: "cc8a-turn",
      type: "interaction",
      scene_id: "room",
      participants: ["A", "B"],
    }],
    scenes: {
      room: {
        scene_id: "room",
        dimensions: { width_m: 8, depth_m: 8 },
        entity_positions: {
          A: { x: 1, y: 1 },
          ...(targetPosition ? { B: targetPosition } : {}),
        },
        visibility_profiles: { A: { horizontal_fov_degrees: 90 } },
      },
    },
    characters: {
      A: { facing_degrees: 0, physical_state: { unconscious } },
      B: { physical_state: {} },
    },
    objects: {},
  };
}

async function adjudicate(state, action) {
  return adjudicateWorldSimulationCausality({
    world_simulation_session_id: "cc8a-test",
    turn_id: "cc8a-turn",
    world_state: state,
    world_state_hash: hashAgentRunValue(state),
    world_state_revision: 0,
    event: state.event_queue[0],
    selected_action_intents: [{
      character: "A",
      selection: "candidate_action_intent",
      candidate: action,
    }],
  });
}

{
  const action = candidate();
  assert.equal(action.communication.embodied_display_request.schema_version,
    "cc8a-embodied-display-request-v1");
  assert.deepEqual(action.communication.embodied_display_request, {
    schema_version: "cc8a-embodied-display-request-v1",
    modality: "gaze",
    target_relation: "addressee",
  });
  const serialized = JSON.stringify(action);
  assert.equal(serialized.includes("不希望 B 現在離開"), false);
  assert.equal(serialized.includes("objective"), false);

  const initial = world();
  const visibleToA = (state) => queryWorldSimulationObserverDirectionalHeightVisibility({
    world_state: state,
    scene_state: state.scenes.room,
    scene_id: "room",
    observer: "A",
  }).result.visible_entities;
  assert.equal(visibleToA(initial).includes("B"), false);
  const result = await adjudicate(initial, action);
  const outcome = result.action_outcomes.find((item) => item.action_id === action.action_id);
  assert.equal(visibleToA(result.next_world_state).includes("B"), true);
  assert.equal(outcome?.result, "communication_emitted");
  assert.equal(result.next_world_state.characters.A.facing_degrees, 90);
  assert.equal(result.state_transitions.some((item) =>
    item.entity === "A"
    && item.field === "facing_degrees"
    && item.to === 90
    && item.source_action_id === action.action_id), true);
  assert.deepEqual(outcome.communication_event.embodied_display, {
    schema_version: "cc8a-embodied-display-realization-v1",
    modality: "gaze",
    target_relation: "addressee",
    effector: "head_orientation",
    realized: true,
    source_action_id: action.action_id,
    private_intended_meaning_exposed: false,
    objective_target_coordinates_exposed: false,
  });
  const eventText = JSON.stringify(outcome.communication_event);
  assert.equal(eventText.includes("不希望 B 現在離開"), false);
  assert.equal(eventText.includes('"x"'), false);
  assert.equal(eventText.includes('"y"'), false);
  assert.equal(initial.characters.A.facing_degrees, 0);
}

{
  const action = candidate({
    display: false,
    signal: "看向 B 並示意停下",
  });
  assert.equal(Object.hasOwn(action.communication, "embodied_display_request"), false);
  const result = await adjudicate(world(), action);
  const outcome = result.action_outcomes.find((item) => item.action_id === action.action_id);
  assert.equal(outcome?.result, "communication_emitted");
  assert.equal(result.next_world_state.characters.A.facing_degrees, 0);
  assert.equal(result.state_transitions.some((item) =>
    item.entity === "A" && item.field === "facing_degrees"), false);
  assert.equal(Object.hasOwn(outcome.communication_event, "embodied_display"), false);
}

{
  const action = candidate();
  const result = await adjudicate(world({ unconscious: true }), action);
  const outcome = result.action_outcomes.find((item) => item.action_id === action.action_id);
  assert.equal(outcome?.result, "blocked");
  assert.match(outcome.causal_evidence, /conscious positioned actor/);
  assert.equal(result.next_world_state.characters.A.facing_degrees, 0);
  assert.equal(result.action_outcomes.some((item) =>
    item.action_id === action.action_id && item.result === "communication_emitted"), false);
}

{
  const action = candidate();
  const result = await adjudicate(world({ targetPosition: null }), action);
  const outcome = result.action_outcomes.find((item) => item.action_id === action.action_id);
  assert.equal(outcome?.result, "blocked");
  assert.match(outcome.causal_evidence, /positioned addressee/);
  assert.equal(result.next_world_state.characters.A.facing_degrees, 0);
}

{
  const speech = candidate({ mode: "direct", display: false });
  assert.equal(Object.hasOwn(speech.communication, "embodied_display_request"), false);
}

{
  const speech = candidate({ mode: "direct", display: false });
  speech.communication.embodied_display_request = {
    schema_version: "cc8a-embodied-display-request-v1",
    modality: "gaze",
    target_relation: "addressee",
  };
  const result = await adjudicate(world(), speech);
  const outcome = result.action_outcomes.find((item) => item.action_id === speech.action_id);
  assert.equal(outcome?.result, "blocked");
  assert.match(outcome.causal_evidence, /invalid embodied communication display request/);
  assert.equal(result.next_world_state.characters.A.facing_degrees, 0);
}

{
  const action = candidate();
  action.target = "C";
  const result = await adjudicate(world(), action);
  const outcome = result.action_outcomes.find((item) => item.action_id === action.action_id);
  assert.equal(outcome?.result, "blocked");
  assert.match(outcome.causal_evidence, /invalid embodied communication display request/);
  assert.equal(result.next_world_state.characters.A.facing_degrees, 0);
}

console.log("CC-8A embodied gaze effector foundation tests passed.");
