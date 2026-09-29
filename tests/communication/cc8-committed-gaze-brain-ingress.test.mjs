import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";
import { projectRoot } from "../../server/src/project-paths.mjs";
import { beginWorldSimulationSession } from "../../server/src/world-simulation-session-service.mjs";
import { commitWorldSimulationTurn, getWorldSimulationState } from "../../server/src/world-simulation-state-service.mjs";
import { buildCharacterCommunicationActionCandidate } from "../../server/src/character-communication-foundation-service.mjs";
import { adjudicateWorldSimulationCausality } from "../../server/src/world-simulation-causal-rule-engine.mjs";
import { readCommittedWorldSimulationObserverGaze } from "../../server/src/world-simulation-communication-gaze-observer-service.mjs";
import { buildCommittedWorldSimulationCharacterBrainInput, buildWorldSimulationCharacterBrainInput } from "../../server/src/world-simulation-character-brain-input-service.mjs";
import { prepareFormalWorldSimulationTurn } from "../../server/src/world-simulation-formal-turn-transport-service.mjs";
import { createEphemeralWorldSimulationPreparedTurnBroker } from "../../server/src/world-simulation-prepared-turn-ephemeral-broker.mjs";
import { createWorldSimulationCharacterRuntimeManager, prepareWorldSimulationTurn, runWorldSimulationTurn } from "../../server/src/world-simulation-loop-service.mjs";
import { run_world_character_cognition } from "../../server/src/world-simulation-neural-service.mjs";

const fixtureRoot = path.join(projectRoot, "tests", ".tmp",
  `cc8c-${process.pid}-${Date.now()}`);
const options = { fixtureRoot };
const action = buildCharacterCommunicationActionCandidate({
  character: "A",
  cognition: { communication_goal: {
    character: "A", addressee: "B", purpose: "請 B 暫停",
    mode: "nonverbal", nonverbal_signal: "以視線示意",
    communication_context: { intentional_display: {
      intended_meaning: "不希望 B 離開", modality: "gaze", target: "B",
    } },
  } },
});
const initial = {
  simulation_time: "2026-09-29T00:00:00.000Z",
  world_rules: { communication_action_seconds: 0.25 },
  event_queue: [
    { event_id: "gaze", type: "interaction", scene_id: "room", participants: ["A", "B"] },
    { event_id: "observe", type: "interaction", scene_id: "room", participants: ["B"] },
  ],
  scenes: { room: {
    scene_id: "room", dimensions: { width_m: 8, depth_m: 8 },
    entity_positions: { A: { x: 1, y: 1 }, B: { x: 1, y: 4 } },
    entity_visual_detail_profiles: {
      A: { head_orientation_discernible: true, head_orientation_max_distance_m: 5 },
    },
  } },
  characters: {
    A: { facing_degrees: 0, physical_state: {}, current_goal: "觀察 B" },
    B: { facing_degrees: 270, physical_state: {}, current_goal: "等候" },
  },
  objects: {}, memories: { A: [], B: [] }, available_actions: { A: [], B: [] },
};
try {
  const session = await beginWorldSimulationSession({
    simulation_label: "CC-8C gaze ingress", seed: "cc8c",
    rules: { event_driven: true, persistent_causality: true },
    initial_world_state: initial,
  }, options);
  const id = session.world_simulation_session_id;
  const first = await getWorldSimulationState(id, options);
  const resolved = await adjudicateWorldSimulationCausality({
    world_simulation_session_id: id, turn_id: "gaze",
    world_state: initial, world_state_hash: first.state_hash,
    world_state_revision: 0, event: initial.event_queue[0],
    selected_action_intents: [{
      character: "A", selection: "candidate_action_intent", candidate: action,
    }],
  });
  await commitWorldSimulationTurn(id, {
    expected_revision: 0, expected_state_hash: first.state_hash,
    turn_id: "gaze", event: initial.event_queue[0],
    next_world_state: resolved.next_world_state,
    selected_action_intents: [{
      character: "A", selection: "candidate_action_intent", candidate: action,
    }],
    action_outcomes: resolved.action_outcomes,
    state_transitions: resolved.state_transitions,
  }, options);
  const committed = await readCommittedWorldSimulationObserverGaze({
    session_id: id, observer: "B", scene_id: "room", expected_revision: 1,
  }, options);
  const built = buildWorldSimulationCharacterBrainInput({
    character: "B", candidate_action_intents: [],
  }, { observer_committed_gaze: committed });
  assert.equal(built.observed_gaze_cues.length, 1);
  assert.equal(built.boundaries.committed_gaze_observer_cue_ingress_v1_installed, true);
  const text = JSON.stringify(built);
  for (const privateValue of [action.action_id, "不希望 B 離開",
    '"source_actor"', '"source_action_id"', '"A"', '"room"'])
    assert.equal(text.includes(privateValue), false, privateValue);
  assert.throws(() => buildWorldSimulationCharacterBrainInput({
    character: "A",
  }, { observer_committed_gaze: committed }), { code: "CC8C_GAZE_BRAIN_INGRESS_INVALID" });
  const forged = structuredClone(committed);
  forged.character_view[0].source_action_id = action.action_id;
  assert.throws(() => buildWorldSimulationCharacterBrainInput({
    character: "B",
  }, { observer_committed_gaze: forged }), { code: "CC8C_GAZE_BRAIN_INGRESS_INVALID" });

  await assert.rejects(run_world_character_cognition({
    character: "B", character_state: {},
    perception: { observed_gaze_cues: committed.character_view },
  }, { ...options, run_id: id }),
  { code: "CC8E_GAZE_EARLY_COGNITION_SOURCE_INVALID" });

  const early = await prepareWorldSimulationTurn({
    world_simulation_session_id: id,
  }, options);
  const earlyPacket = early.decision_packets.find((packet) => packet.character === "B");
  assert(earlyPacket);
  assert.deepEqual(earlyPacket.cognition.perception.observed_gaze_cues,
    committed.character_view);
  assert.equal(Object.hasOwn(earlyPacket.perception, "observed_gaze_cues"), false);
  const earlyText = JSON.stringify(earlyPacket.cognition.perception.observed_gaze_cues);
  assert.equal(earlyText.includes(action.action_id), false);
  assert.equal(earlyText.includes("不希望 B 離開"), false);
  assert.throws(() => buildWorldSimulationCharacterBrainInput(earlyPacket),
    { code: "CC8C_GAZE_BRAIN_INGRESS_INVALID" });
  const tamperedEarly = structuredClone(earlyPacket);
  tamperedEarly.cognition.perception.observed_gaze_cues[0].cue_ref =
    "gaze_cue_" + "0".repeat(24);
  assert.throws(() => buildWorldSimulationCharacterBrainInput(tamperedEarly,
    { observer_committed_gaze: committed }),
  { code: "CC8C_GAZE_BRAIN_INGRESS_INVALID" });
  const committedInput = await buildCommittedWorldSimulationCharacterBrainInput({
    session_id: id, decision_packet: earlyPacket, expected_revision: 1,
  }, options);
  assert.deepEqual(committedInput.observed_gaze_cues, built.observed_gaze_cues);
  assert.equal(Object.hasOwn(committedInput.cognition.perception,
    "observed_gaze_cues"), false);
  assert.equal(committedInput.boundaries.committed_gaze_early_cognition_duplicate_removed,
    true);
  const committedText = JSON.stringify(committedInput);
  assert.equal(committedText.includes(action.action_id), false);
  assert.equal(committedText.includes("不希望 B 離開"), false);
  await assert.rejects(buildCommittedWorldSimulationCharacterBrainInput({
    session_id: id, decision_packet: tamperedEarly, expected_revision: 1,
  }, options), { code: "CC8C_GAZE_BRAIN_INGRESS_INVALID" });
  await assert.rejects(buildCommittedWorldSimulationCharacterBrainInput({
    session_id: id, decision_packet: earlyPacket, expected_revision: 0,
  }, options), { code: "BODY1H_STATE_REVISION_CHANGED" });

  const prepared = await prepareFormalWorldSimulationTurn({
    world_simulation_session_id: id,
  }, { ...options, preparedTurnBroker: createEphemeralWorldSimulationPreparedTurnBroker() });
  assert.equal(prepared.current_decision?.character_input?.character, "B");
  assert.deepEqual(prepared.current_decision.character_input.observed_gaze_cues,
    built.observed_gaze_cues);
  assert.equal(Object.hasOwn(prepared.current_decision.character_input.cognition.perception,
    "observed_gaze_cues"), false);
  assert.equal(prepared.current_decision.character_input.boundaries
    .committed_gaze_early_cognition_duplicate_removed, true);
  const formalText = JSON.stringify(prepared.current_decision.character_input);
  assert.equal(formalText.includes(action.action_id), false);
  assert.equal(formalText.includes("不希望 B 離開"), false);
  assert.equal(formalText.includes('"source_actor"'), false);

  // The separate native World turn route must admit the same committed cue.
  // A reject-all decision suffices: this checks the actual Brain callback
  // before any new World outcome can feed back into its own input.
  const nativeInputs = [];
  const nativeResult = await runWorldSimulationTurn({
    world_simulation_session_id: id, event_id: "observe",
  }, {
    ...options,
    characterRuntimeManager: createWorldSimulationCharacterRuntimeManager({
      identityResolver: async (character) => ({
        entity_id: "character_" + character.toLowerCase(),
        canonical_name: character, formal: true,
        identity_source: "cc8d_native_test",
      }),
    }),
    characterBrain: async (packet) => {
      nativeInputs.push(packet);
      return "reject_all";
    },
  });
  assert.equal(nativeResult.committed, true);
  assert.equal(nativeInputs.length, 1);
  assert.equal(nativeInputs[0].character, "B");
  assert.deepEqual(nativeInputs[0].observed_gaze_cues, built.observed_gaze_cues);
  assert.equal(Object.hasOwn(nativeInputs[0].cognition.perception,
    "observed_gaze_cues"), false);
  const nativeText = JSON.stringify(nativeInputs[0]);
  assert.equal(nativeText.includes(action.action_id), false);
  assert.equal(nativeText.includes("不希望 B 離開"), false);
  assert.equal(nativeText.includes('"source_action_id"'), false);
  console.log("CC-8C/D/E committed gaze formal, native and early cognition ingress tests passed.");
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
