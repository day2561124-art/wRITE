import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";

import { projectRoot } from "../../server/src/project-paths.mjs";
import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import { beginWorldSimulationSession } from "../../server/src/world-simulation-session-service.mjs";
import { commitWorldSimulationTurn, getWorldSimulationState } from "../../server/src/world-simulation-state-service.mjs";
import { buildCharacterCommunicationActionCandidate } from "../../server/src/character-communication-foundation-service.mjs";
import { adjudicateWorldSimulationCausality } from "../../server/src/world-simulation-causal-rule-engine.mjs";
import { readCommittedWorldSimulationObserverOrientations } from "../../server/src/world-simulation-communication-orientation-observer-service.mjs";
import {
  buildCommittedWorldSimulationCharacterBrainInput,
  buildWorldSimulationCharacterBrainInput,
} from "../../server/src/world-simulation-character-brain-input-service.mjs";
import { prepareFormalWorldSimulationTurn } from "../../server/src/world-simulation-formal-turn-transport-service.mjs";
import { createEphemeralWorldSimulationPreparedTurnBroker } from "../../server/src/world-simulation-prepared-turn-ephemeral-broker.mjs";
import {
  createWorldSimulationCharacterRuntimeManager,
  runWorldSimulationTurn,
} from "../../server/src/world-simulation-loop-service.mjs";

const fixtureRoot = path.join(projectRoot, "tests", ".tmp",
  `cc8n-${process.pid}-${Date.now()}`);
const options = { fixtureRoot };

function displayAction(character, modality, meaning) {
  return buildCharacterCommunicationActionCandidate({
    character,
    cognition: { communication_goal: {
      character,
      addressee: "B",
      purpose: "請 B 留意",
      mode: "nonverbal",
      nonverbal_signal: modality === "gaze" ? "以視線示意" : "以身體朝向示意",
      communication_context: { intentional_display: {
        intended_meaning: meaning,
        modality,
        target: "B",
      } },
    } },
  });
}

const gaze = displayAction("A", "gaze", "A 的私下意圖");
const body = displayAction("C", "body", "C 的私下意圖");
const orientationEvent = {
  event_id: "orientation",
  type: "interaction",
  scene_id: "room",
  participants: ["A", "B", "C"],
};
const observeEvent = {
  event_id: "observe",
  type: "interaction",
  scene_id: "room",
  participants: ["B"],
};
const initial = {
  simulation_time: "2026-09-29T00:00:00.000Z",
  world_rules: { communication_action_seconds: 0.25 },
  event_queue: [orientationEvent, observeEvent],
  scenes: { room: {
    scene_id: "room",
    dimensions: { width_m: 10, depth_m: 10 },
    entity_positions: {
      A: { x: 1, y: 1 },
      B: { x: 1, y: 4 },
      C: { x: 4, y: 4 },
    },
    entity_visual_detail_profiles: {
      A: {
        head_orientation_discernible: true,
        head_orientation_max_distance_m: 5,
      },
      C: {
        body_orientation_discernible: true,
        body_orientation_max_distance_m: 5,
      },
    },
  } },
  characters: {
    A: { facing_degrees: 0, physical_state: {}, known: [] },
    B: {
      facing_degrees: 270,
      body_facing_degrees: 270,
      physical_state: {},
      known: [],
      current_goal: "觀察周遭",
    },
    C: {
      facing_degrees: 0,
      body_facing_degrees: 0,
      physical_state: {},
      known: [],
    },
  },
  objects: {},
  memories: { A: [], B: [], C: [] },
  available_actions: { A: [], B: [], C: [] },
};

try {
  const session = await beginWorldSimulationSession({
    simulation_label: "CC-8N converged orientation Brain ingress",
    seed: "cc8n",
    rules: { event_driven: true, persistent_causality: true },
    initial_world_state: initial,
  }, options);
  const id = session.world_simulation_session_id;
  const first = await getWorldSimulationState(id, options);
  const selected = [
    { character: "A", selection: "candidate_action_intent", candidate: gaze },
    { character: "C", selection: "candidate_action_intent", candidate: body },
  ];
  const resolved = await adjudicateWorldSimulationCausality({
    world_simulation_session_id: id,
    turn_id: "orientation",
    world_state: first.state,
    world_state_hash: first.state_hash,
    world_state_revision: first.revision,
    event: orientationEvent,
    selected_action_intents: selected,
  });
  await commitWorldSimulationTurn(id, {
    expected_revision: first.revision,
    expected_state_hash: first.state_hash,
    turn_id: "orientation",
    event: orientationEvent,
    next_world_state: resolved.next_world_state,
    selected_action_intents: selected,
    action_outcomes: resolved.action_outcomes,
    state_transitions: resolved.state_transitions,
  }, options);

  const post = await getWorldSimulationState(id, options);
  const receipt = await readCommittedWorldSimulationObserverOrientations({
    session_id: id,
    observer: "B",
    scene_id: "room",
    expected_revision: post.revision,
    expected_state_hash: post.state_hash,
  }, options);
  assert.deepEqual(receipt.character_view.map((cue) => cue.kind), [
    "visible_head_orientation_change",
    "visible_body_orientation_change",
  ]);

  const direct = buildWorldSimulationCharacterBrainInput({
    character: "B",
    cognition: { perception: {} },
    candidate_action_intents: [],
    boundaries: {},
  }, { observer_committed_orientations: receipt });
  assert.equal(direct.observed_gaze_cues.length, 1);
  assert.equal(direct.observed_body_orientation_cues.length, 1);
  assert.equal(direct.boundaries
    .committed_orientation_converged_snapshot_v1_installed, true);
  assert.equal(direct.boundaries.committed_orientation_cue_fusion_performed, false);
  assert.equal(direct.boundaries.committed_orientation_intent_inference_performed,
    false);
  assert.equal(direct.boundaries.committed_orientation_engine_audit_exposed, false);

  const exposed = JSON.stringify(direct);
  for (const hidden of [
    gaze.action_id,
    body.action_id,
    "A 的私下意圖",
    "C 的私下意圖",
    '"source_actor"',
    '"source_action_id"',
    '"source_state_hash"',
  ]) {
    assert.equal(exposed.includes(hidden), false, hidden);
  }

  const forged = structuredClone(receipt);
  forged.character_view.push({
    schema_version: "cc8x-forged-orientation-v1",
    kind: "visible_face_expression",
    cue_ref: "forged",
  });
  assert.throws(() => buildWorldSimulationCharacterBrainInput({
    character: "B",
  }, { observer_committed_orientations: forged }),
  { code: "CC8N_ORIENTATION_BRAIN_INGRESS_INVALID" });
  assert.throws(() => buildWorldSimulationCharacterBrainInput({
    character: "B",
  }, {
    observer_committed_orientations: receipt,
    observer_committed_gaze: {
      schema_version: "cc8b-committed-gaze-observer-cue-v1",
      observer: "B",
      admission_status: "no_admitted_visual_cue",
      character_view: [],
    },
  }), { code: "CC8N_ORIENTATION_BRAIN_INGRESS_INVALID" });

  const committedInput = await buildCommittedWorldSimulationCharacterBrainInput({
    session_id: id,
    decision_packet: {
      character: "B",
      cognition: { perception: {} },
      candidate_action_intents: [],
      boundaries: {},
    },
    expected_revision: post.revision,
    expected_state_hash: post.state_hash,
  }, options);
  assert.equal(committedInput.observed_gaze_cues.length, 1);
  assert.equal(committedInput.observed_body_orientation_cues.length, 1);
  assert.equal(committedInput.boundaries
    .committed_orientation_converged_snapshot_v1_installed, true);

  const formal = await prepareFormalWorldSimulationTurn({
    world_simulation_session_id: id,
  }, {
    ...options,
    preparedTurnBroker: createEphemeralWorldSimulationPreparedTurnBroker(),
  });
  assert.equal(formal.current_decision?.character_input?.character, "B");
  assert.equal(formal.current_decision.character_input.observed_gaze_cues.length, 1);
  assert.equal(formal.current_decision.character_input
    .observed_body_orientation_cues.length, 1);
  assert.equal(formal.current_decision.character_input.boundaries
    .committed_orientation_converged_snapshot_v1_installed, true);

  const nativeInputs = [];
  const native = await runWorldSimulationTurn({
    world_simulation_session_id: id,
    event_id: "observe",
  }, {
    ...options,
    characterRuntimeManager: createWorldSimulationCharacterRuntimeManager({
      identityResolver: async (character) => ({
        entity_id: `character_${character.toLowerCase()}`,
        canonical_name: character,
        identity_source: "cc8n_test_identity",
        formal: true,
      }),
    }),
    characterBrain: async (packet) => {
      nativeInputs.push(structuredClone(packet));
      return "reject_all";
    },
  });
  assert.equal(native.committed, true);
  assert.equal(nativeInputs.length, 1);
  assert.equal(nativeInputs[0].character, "B");
  assert.equal(nativeInputs[0].observed_gaze_cues.length, 1);
  assert.equal(nativeInputs[0].observed_body_orientation_cues.length, 1);
  assert.equal(nativeInputs[0].boundaries
    .committed_orientation_converged_snapshot_v1_installed, true);
  const nativeText = JSON.stringify(nativeInputs[0]);
  assert.equal(nativeText.includes(gaze.action_id), false);
  assert.equal(nativeText.includes(body.action_id), false);

  console.log("CC-8N converged committed orientation Brain ingress tests passed.");
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
