import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";

import {
  projectRoot,
} from "../../server/src/project-paths.mjs";
import {
  beginWorldSimulationSession,
  useWorldSimulationCapability,
} from "../../server/src/world-simulation-session-service.mjs";
import {
  buildWorldSimulationCapabilityRegistry,
  worldSimulationCapabilityNames,
} from "../../server/src/world-simulation-neural-service.mjs";
import {
  summarizeNeuralUsageForRun,
} from "../../server/src/neural-trace-service.mjs";

const fixtureRoot = path.join(
  projectRoot,
  "tests",
  ".tmp",
  "phase62a-world-simulation-neural-bridge",
);

await rm(fixtureRoot, { recursive: true, force: true });

try {
  const registry = buildWorldSimulationCapabilityRegistry();
  assert.deepEqual(
    Object.keys(registry.capabilities),
    [...worldSimulationCapabilityNames],
  );
  assert.equal(
    registry.world_simulation_common_permissions.mutate_world_state,
    false,
  );
  assert.equal(
    registry.world_simulation_common_permissions.decide_action_outcome,
    false,
  );
  assert.equal(
    registry.world_simulation_common_permissions.optimize_for_drama,
    false,
  );

  const session = await beginWorldSimulationSession({
    simulation_label: "Phase62A fixture",
    seed: "fixture-seed",
    rules: {
      world_first: true,
      camera_has_no_causality: true,
    },
  }, { fixtureRoot });

  assert.equal(session.ok, true);
  assert.match(session.world_simulation_session_id, /^agent_run_/u);
  assert.equal(session.world_state_owner, "programmatic_world_simulator");

  const sessionId = session.world_simulation_session_id;
  const sceneInput = {
    scene_state: {
      scene_id: "dorm-301",
      location: "宿舍301",
      dimensions: { width_m: 5.2, depth_m: 4.6 },
      exits: [{ id: "door-south", side: "south", open: true }],
      structures: [
        { id: "bed-east", type: "bed", side: "east" },
        { id: "desk-west", type: "desk", side: "west" },
      ],
      entity_positions: {
        "伊萊亞斯・諾爾": { x: 1.2, y: 2.1 },
      },
      object_positions: {
        terminal: { x: 1.1, y: 2.0 },
      },
    },
    simultaneous_actions: [
      {
        actor: "伊萊亞斯・諾爾",
        intent: "走向門口",
        start_time: "07:18:20.000",
        position: { x: 1.2, y: 2.1 },
        speed: 1.1,
      },
    ],
  };
  const sceneSnapshot = JSON.stringify(sceneInput);
  const scene = await useWorldSimulationCapability(
    "world_scene_causal_analyzer",
    {
      world_simulation_session_id: sessionId,
      capability_input: sceneInput,
    },
    { fixtureRoot },
  );
  assert.equal(JSON.stringify(sceneInput), sceneSnapshot, "scene analyzer mutated simulator input");
  assert.equal(scene.output.result_type, "world_scene_causal_analysis");
  assert.equal(scene.output.adjudication_inputs.length, 1);
  assert.match(scene.output.outcome_boundary, /never decides hit|never decides/i);

  const secret = "SECRET_PRIVATE_PHONE_MESSAGE";
  const perception = await useWorldSimulationCapability(
    "world_perception_filter",
    {
      world_simulation_session_id: sessionId,
      capability_input: {
        character: "伊萊亞斯・諾爾",
        scene_state: {
          scene_id: "dorm-301",
          public_audio: ["走廊傳來腳步聲"],
          observable_by: {
            "伊萊亞斯・諾爾": {
              visual: ["終端螢幕亮起，但內容未朝向鏡頭"],
            },
          },
          hidden: {
            private_terminal_contents: secret,
          },
        },
        observations: {
          visual: ["阿灰趴在床邊"],
        },
      },
    },
    { fixtureRoot },
  );
  assert.equal(perception.output.information_boundary.hidden_scene_fields_read, false);
  assert.equal(JSON.stringify(perception.output).includes(secret), false);
  assert(perception.output.observed.includes("阿灰趴在床邊"));
  assert(perception.output.audible.includes("走廊傳來腳步聲"));

  const memory = await useWorldSimulationCapability(
    "world_memory_retriever",
    {
      world_simulation_session_id: sessionId,
      capability_input: {
        character: "伊萊亞斯・諾爾",
        memory_records: [
          {
            memory_id: "m1",
            content: "昨天有人提醒早上要去實習室。",
            source: { kind: "heard_from_person", actor: "同學" },
            confidence: 0.72,
            clarity: 0.61,
            possibly_incorrect: true,
          },
          {
            memory_id: "m2",
            content: "不應被取出的隱藏記憶",
            accessible: false,
          },
        ],
      },
    },
    { fixtureRoot },
  );
  assert.equal(memory.output.retrieved_memories.length, 1);
  assert.equal(memory.output.retrieved_memories[0].possibly_incorrect, true);
  assert.equal(memory.output.memory_boundary.memory_is_not_world_truth, true);

  const cognition = await useWorldSimulationCapability(
    "world_character_cognition",
    {
      world_simulation_session_id: sessionId,
      capability_input: {
        character: "伊萊亞斯・諾爾",
        character_state: {
          current_emotion: "有點睏",
          needs: { fatigue: 0.68, hunger: 0.31 },
          current_goal: "準時去第三實習室",
          known: ["現在人在宿舍"],
          guessed: ["實習內容可能臨時更改"],
          attention: ["終端通知聲", "時間"],
          current_action: "整理背包",
        },
        perception: perception.output,
        retrieved_memories: memory.output.retrieved_memories,
      },
    },
    { fixtureRoot },
  );
  assert.equal(cognition.output.cognition_boundary.world_truth_not_injected, true);
  assert(cognition.output.known.includes("現在人在宿舍"));
  assert(cognition.output.uncertain.includes("實習內容可能臨時更改"));

  const actions = await useWorldSimulationCapability(
    "world_action_proposer",
    {
      world_simulation_session_id: sessionId,
      capability_input: {
        character: "伊萊亞斯・諾爾",
        available_actions: [
          { id: "continue-pack", intent: "繼續整理背包" },
          { id: "check-time", intent: "看一眼時間" },
          { id: "leave", intent: "離開宿舍前往實習室" },
        ],
        cognition: cognition.output,
      },
    },
    { fixtureRoot },
  );
  assert.equal(actions.output.candidate_action_intents.length, 3);
  assert.match(actions.output.selection_boundary, /non-binding|chooses/i);
  assert.match(actions.output.outcome_boundary, /causal simulator/i);
  assert.equal(Object.hasOwn(actions.output, "selected_action"), false);

  const agency = await useWorldSimulationCapability(
    "world_agency_guard",
    {
      world_simulation_session_id: sessionId,
      capability_input: {
        character: "伊萊亞斯・諾爾",
        decision_request: {
          dramatic_priority: "這一幕需要更刺激",
          camera_priority: "讓他碰到重要角色",
          desired_romance_progress: true,
        },
      },
    },
    { fixtureRoot },
  );
  assert.equal(agency.output.findings.length, 3);
  assert(agency.output.findings.every((finding) => finding.must_ignore_for_character_choice));

  const consistency = await useWorldSimulationCapability(
    "world_consistency_critic",
    {
      world_simulation_session_id: sessionId,
      capability_input: {
        state_transitions: [
          {
            entity: "伊萊亞斯・諾爾",
            field: "location",
            from: "宿舍",
            to: "食堂",
          },
          {
            entity: "door-south",
            field: "open",
            from: false,
            to: true,
            cause: "伊萊亞斯開門",
          },
        ],
        object_holders: [
          { object_id: "terminal-01", holder: "伊萊亞斯・諾爾" },
          { object_id: "terminal-01", holder: "陌生學生" },
        ],
        knowledge_transitions: [
          {
            character: "伊萊亞斯・諾爾",
            proposition: "B 的私人對話內容",
            became_known: true,
          },
        ],
        action_outcomes: [
          {
            actor: "A",
            action: "攻擊 B",
            result: "命中",
          },
        ],
      },
    },
    { fixtureRoot },
  );
  const issueTypes = new Set(consistency.output.findings.map((finding) => finding.issue_type));
  assert(issueTypes.has("state_changed_without_recorded_cause"));
  assert(issueTypes.has("duplicate_exclusive_holder"));
  assert(issueTypes.has("knowledge_gain_without_source"));
  assert(issueTypes.has("outcome_without_causal_adjudication"));
  assert.equal(consistency.output.hard_conflict_count, 4);

  const usage = await summarizeNeuralUsageForRun(sessionId, { fixtureRoot });
  assert.equal(usage.success_count, 7);
  assert.deepEqual(
    new Set(usage.neural_modules_used),
    new Set(worldSimulationCapabilityNames),
  );
  assert.equal(usage.missing_required_neural_modules.length, 0);

  console.log(JSON.stringify({
    world_simulation_session_id: sessionId,
    successful_world_capabilities: usage.neural_modules_used,
    consistency_findings: consistency.output.findings.length,
  }));
  console.log("Phase62A world simulation neural bridge test passed.");
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
