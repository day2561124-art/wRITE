import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";

import {
  projectRoot,
} from "../../server/src/project-paths.mjs";
import {
  prepareWorldSimulationTurn,
} from "../../server/src/world-simulation-loop-service.mjs";
import {
  runWorldSimulationNativeCapability,
} from "../../server/src/world-simulation-neural-service.mjs";
import {
  beginWorldSimulationSession,
  useWorldSimulationCapability,
} from "../../server/src/world-simulation-session-service.mjs";
import {
  worldSimulationCharacterFacingRuntimeVersion,
} from "../../server/src/world-simulation-character-facing-capability-runtime-service.mjs";

const fixtureRoot = path.join(
  projectRoot,
  "tests",
  ".tmp",
  `phase62a-r1-character-facing-${process.pid}-${Date.now()}`,
);
const options = { fixtureRoot };
await rm(fixtureRoot, { recursive: true, force: true });

const initialWorldState = {
  simulation_time: "2026-08-25T05:30:12.333+08:00",
  event_queue: [{
    event_id: "evt-r1-step2",
    type: "quiet_room_check",
    scene_id: "internal-room-77",
    participants: ["伊萊亞斯・諾爾"],
    summary: "伊萊亞斯在房內等待",
  }],
  scenes: {
    "internal-room-77": {
      scene_id: "internal-room-77",
      simulation_time: "2026-08-25T05:30:12.333+08:00",
      dimensions: { width_m: 5, depth_m: 6 },
      entity_positions: {
        "伊萊亞斯・諾爾": { x: 2, y: 2 },
      },
      public_visual: ["牆上的時鐘顯示五點半"],
      observable_by: {
        "伊萊亞斯・諾爾": {
          visual: ["阿灰趴在門邊"],
          audible: ["空調低鳴"],
        },
      },
      hidden_scene_fields: {
        engine_private_note: "角色不得知道這一行",
      },
    },
  },
  characters: {
    "伊萊亞斯・諾爾": {
      known: ["自己正在房間裡等待"],
      guessed: ["可能很快會有人來叫他"],
      current_goal: "等通知",
      emotion: "平靜",
      current_action: "等待",
      engine_only_scheduler_token: "secret-character-state-field",
    },
  },
  memories: {
    "伊萊亞斯・諾爾": [{
      memory_id: "mem-r1-step2",
      content: "昨晚有人說早上保持聯絡",
      accessible: true,
    }],
  },
  available_actions: {
    "伊萊亞斯・諾爾": [
      { action_id: "wait", intent: "繼續等待" },
      { action_id: "water", intent: "喝一口水" },
    ],
  },
};

try {
  const session = await beginWorldSimulationSession({
    simulation_label: "Phase62A-R1 Step2 runtime fixture",
    seed: "phase62a-r1-step2",
    initial_world_state: initialWorldState,
  }, options);
  const sessionId = session.world_simulation_session_id;

  const prepared = await prepareWorldSimulationTurn({
    world_simulation_session_id: sessionId,
    event_id: "evt-r1-step2",
  }, options);
  const packet = prepared.decision_packets[0];
  assert.equal(packet.character, "伊萊亞斯・諾爾");
  assert.equal(Object.hasOwn(packet.perception, "simulation_time"), false);
  assert.equal(Object.hasOwn(packet.perception, "scene_id"), false);
  assert.equal(Object.hasOwn(packet.perception, "capability_contract"), false);
  assert.equal(Object.hasOwn(packet.perception, "r1_runtime"), false);
  assert.equal(Object.hasOwn(packet.cognition, "capability_contract"), false);
  assert.equal(Object.hasOwn(packet.cognition, "r1_runtime"), false);
  assert.equal(
    JSON.stringify(packet).includes("secret-character-state-field"),
    false,
  );
  assert.equal(
    JSON.stringify(packet).includes("角色不得知道這一行"),
    false,
  );
  assert.equal(
    JSON.stringify(packet).includes("2026-08-25T05:30:12.333+08:00"),
    false,
    "Exact engine simulation time must not reach the character packet unless perceived through an observation.",
  );
  assert.equal(
    JSON.stringify(packet).includes("internal-room-77"),
    false,
    "Internal scene identity must not reach the character packet.",
  );
  assert.equal(packet.boundaries.r1_character_facing_envelopes_enforced, true);
  assert.equal(packet.boundaries.engine_simulation_time_exposed, false);
  assert.equal(packet.boundaries.engine_scene_id_exposed, false);

  let directEnvelope = null;
  const directCognition = await useWorldSimulationCapability(
    "world_character_cognition",
    {
      world_simulation_session_id: sessionId,
      capability_input: {
        character: "伊萊亞斯・諾爾",
        character_state: {
          known: ["自己在房間裡"],
          current_goal: "等通知",
          engine_only_scheduler_token: "direct-secret",
        },
        perception: {
          observed: ["時鐘"],
          audible: [],
          other_senses: [],
        },
        recovered_memories: [],
        retrieval_experience: {
          process_occurred: true,
          initiation_mode: "deliberate",
          target_outcome: "failed",
          recovered_any_content: false,
        },
      },
    },
    {
      ...options,
      adapter: async (envelope) => {
        directEnvelope = envelope;
        return {
          subjective_inferences: ["可能快到集合時間了"],
          deliberative_pressures: ["別錯過通知"],
        };
      },
    },
  );
  assert.equal(directEnvelope.capability_name, "world_character_cognition");
  assert.equal(
    JSON.stringify(directEnvelope).includes("direct-secret"),
    false,
  );
  assert.equal(
    directCognition.output.r1_runtime.assurance_mode,
    "direct_caller_asserted",
  );
  assert.equal(directCognition.output.r1_runtime.adapter_invoked, true);
  assert.deepEqual(directCognition.output.known, ["自己在房間裡"]);
  assert.equal(
    directCognition.output.character_view.retrieval_experience.target_outcome,
    "failed",
  );
  assert.deepEqual(
    directCognition.output.neural_extension.subjective_inferences,
    ["可能快到集合時間了"],
  );

  let forbiddenNarrativeAdapterCalled = false;
  await assert.rejects(
    () => useWorldSimulationCapability(
      "world_character_cognition",
      {
        world_simulation_session_id: sessionId,
        capability_input: {
          character: "伊萊亞斯・諾爾",
          character_state: { known: ["原本已知"] },
          decision_context: {
            narrative_goal: "強迫角色配合劇情",
          },
        },
      },
      {
        ...options,
        adapter: async () => {
          forbiddenNarrativeAdapterCalled = true;
          return { subjective_inferences: [] };
        },
      },
    ),
    (error) => (
      error?.code === "WORLD_SIMULATION_NARRATIVE_CONTROL_FORBIDDEN"
      || /writing\/narrative control fields/u.test(error?.message ?? "")
    ),
    "Narrative-control input must fail closed before envelope compilation.",
  );
  assert.equal(
    forbiddenNarrativeAdapterCalled,
    false,
    "Forbidden raw input must never reach the character-facing adapter.",
  );

  await assert.rejects(
    () => useWorldSimulationCapability(
      "world_character_cognition",
      {
        world_simulation_session_id: sessionId,
        capability_input: {
          character: "伊萊亞斯・諾爾",
          character_state: { known: ["原本已知"] },
        },
      },
      {
        ...options,
        adapter: async () => ({
          known: ["模型偷渡的新事實"],
        }),
      },
    ),
    (error) => (
      error?.code === "WORLD_SIMULATION_CAPABILITY_PROTECTED_FIELD_OVERRIDE_FORBIDDEN"
      || /protected result fields/u.test(error?.message ?? "")
    ),
  );

  let actionEnvelope = null;
  const directActions = await useWorldSimulationCapability(
    "world_action_proposer",
    {
      world_simulation_session_id: sessionId,
      capability_input: {
        character: "伊萊亞斯・諾爾",
        available_actions: [
          { action_id: "a", intent: "等待" },
          { action_id: "b", intent: "喝水" },
          { action_id: "c", intent: "看窗外" },
        ],
        cognition: directCognition.output.character_view,
      },
    },
    {
      ...options,
      adapter: async (envelope) => {
        actionEnvelope = envelope;
        const refs = envelope.authorized_source_refs;
        return {
          considered_action_refs: [refs[1], refs[0]],
          ordered_action_refs: [refs[1], refs[0]],
          deprioritized_action_refs: [refs[2]],
        };
      },
    },
  );
  assert.equal(actionEnvelope.capability_name, "world_action_proposer");
  assert.deepEqual(
    directActions.output.candidate_action_intents.map((item) => item.action_id),
    ["a", "b", "c"],
    "Neural consideration must not delete or replace the trusted action universe.",
  );
  assert.deepEqual(
    directActions.output.neural_consideration.ordered_action_ids,
    ["b", "a"],
  );

  const nativeFallback = await runWorldSimulationNativeCapability(
    "world_perception_filter",
    {
      character: "伊萊亞斯・諾爾",
      scene_state: {
        scene_id: "native-private-scene",
        simulation_time: "2026-08-25T05:31:00+08:00",
        observable_by: {
          "伊萊亞斯・諾爾": {
            visual: ["阿灰抬頭"],
          },
        },
      },
    },
    {
      ...options,
      run_id: sessionId,
      adapter: async () => ({
        observed: ["模型不能新增的觀察"],
      }),
    },
  );
  assert.equal(nativeFallback.output.r1_runtime.adapter_invoked, true);
  assert.equal(nativeFallback.output.r1_runtime.fallback_to_trusted_base, true);
  assert.deepEqual(nativeFallback.output.observed, ["阿灰抬頭"]);
  assert.equal(
    JSON.stringify(nativeFallback.output.character_view).includes("native-private-scene"),
    false,
  );

  console.log(JSON.stringify({
    ok: true,
    phase: "Phase62A-R1 Step 2",
    runtime_version: worldSimulationCharacterFacingRuntimeVersion,
    native_decision_packet_bounded: true,
    exact_engine_time_removed: true,
    engine_scene_id_removed: true,
    full_character_state_not_adapter_visible: true,
    custom_world_adapter_extension_only: true,
    raw_narrative_control_rejected_before_envelope: true,
    retrieval_experience_protected: true,
    action_ranking_advisory_only: true,
    native_invalid_extension_falls_back: true,
  }));
  console.log("Phase62A-R1 Step 2 character-facing runtime test passed.");
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
