import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildChatgptNativeNeuralWritingHandoff,
  classifyChatgptNativeConsumerOutputAgainstVisualReferenceContract,
} from "../../server/src/chatgpt-native-neural-writing-handoff-service.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..", "..");

const taskPrompt = "依最新主核對表正式續寫下一章。只輸出正文，從章名開始。";

const expectedNeuralModules = [
  "run_scene_planner",
  "run_character_simulator",
  "run_neural_critic",
  "run_style_drift_detector",
  "run_over_governance_detector",
  "run_writing_card_director",
];

function fakeContextBundle() {
  const visual_uploaded_references = {
    loaded: true,
    reference_count: 2,
    injection_scope: "writing_context_visual_only",
    canon_status: "reference_only",
    safety_contract: {
      visual_only: true,
      must_not_establish_canon: true,
      must_not_infer_abilities: true,
      must_not_infer_relationships: true,
      must_not_update_active_engine: true,
      must_not_update_canon_db: true,
    },
    items: [
      {
        visual_id: "VIS-PHASE39K-MISAKI-REVERSAL",
        character: "御先反轉型態",
        title: "御先反轉型態 user uploaded visual reference",
        canon_status: "reference",
        ability_state: "visual_only",
        visual_usage_scope: "visual_only_reference",
        allowed_usage: [
          "appearance guidance",
          "pose guidance",
          "style guidance",
          "atmosphere guidance",
        ],
        forbidden_usage: [
          "canon facts",
          "ability mechanics",
          "soul weapons",
          "relationships",
          "ranks",
          "factions",
          "timeline events",
          "chapter outcomes",
        ],
      },
      {
        visual_id: "VIS-PHASE39K-CATWOLF",
        character: "貓狼",
        title: "貓狼 user uploaded visual reference",
        canon_status: "reference",
        ability_state: "visual_only",
        visual_usage_scope: "visual_only_reference",
        allowed_usage: [
          "appearance guidance",
          "pose guidance",
          "style guidance",
          "atmosphere guidance",
        ],
        forbidden_usage: [
          "canon facts",
          "ability mechanics",
          "soul weapons",
          "relationships",
          "ranks",
          "factions",
          "timeline events",
          "chapter outcomes",
        ],
      },
    ],
  };

  return {
    bundle_id: "phase39k-visual-reference-consumer-output-misuse-fixture-context",
    task_prompt: taskPrompt,
    output_mode: "chat_only",
    neural_pipeline_required: true,
    required_neural_modules: expectedNeuralModules,
    engine_components_status: {
      components: {
        neural_pipeline: {
          modules: expectedNeuralModules.map((name) => ({
            name,
            required_status: "available",
          })),
        },
      },
    },
    active_engine_excerpt_or_reference: {
      text: "active_engine reference only: text canon overrides visual-only references.",
    },
    writing_card_excerpt_or_reference: {
      text: "圖片只能作外觀、姿態、服裝與氛圍參考。",
    },
    proofing_card_excerpt_or_reference: {
      text: "Final output must reject visual-only reference misuse.",
    },
    longline_excerpt_or_reference: {
      text: "長線承接只依文字正史。",
    },
    retrieval_context: {
      phase: "39K",
      visual_uploaded_references,
    },
    generation_context: {
      phase: "39K",
      visual_uploaded_references,
    },
  };
}

const result = await buildChatgptNativeNeuralWritingHandoff({
  task_prompt: taskPrompt,
  generation_context: {
    phase: "39K",
    route_expectation: "visual_reference_consumer_output_misuse_fixture",
  },
  retrieval_context: {
    acceptance_smoke: "phase39k",
  },
  chapter_mode: "next_chapter",
  output_mode: "chatgpt_native_handoff",
  max_context_chars: 48000,
}, {
  buildGptWritingContextFn: async () => fakeContextBundle(),
});

assert.equal(result.tool_name, "chatgpt_bridge_build_full_neural_writing_handoff");
assert.equal(result.status, "ready_for_chatgpt_native_generation");
assert.equal(result.candidate_created, false);
assert.equal(result.candidate_id, null);
assert.equal(result.canon_updated, false);
assert.equal(result.active_engine_updated, false);
assert.equal(result.adopted, false);
assert.equal(result.settled, false);

const handoff = result.chatgpt_native_writing_handoff;
assert.equal(handoff.used, true);
assert.equal(handoff.contract_valid, true);
assert.equal(handoff.surface_kind, "chatgpt_native_full_neural_writing_handoff");

assert.equal(handoff.constraints.visual_reference_final_instruction_hardened, true);
assert.equal(handoff.constraints.visual_reference_consumer_contract_hardened, true);
assert.equal(handoff.constraints.visual_reference_canon_inference_allowed, false);
assert.equal(handoff.constraints.visual_reference_active_engine_update_allowed, false);
assert.equal(handoff.constraints.visual_reference_canon_db_update_allowed, false);

const consumerContract = handoff.chatgpt_native_consumer_contract;
assert.equal(consumerContract.visual_reference_consumer_contract_hardened, true);

const visualConsumerContract = consumerContract.visual_reference_consumer_contract;
assert.equal(visualConsumerContract.enabled, true);
assert.equal(visualConsumerContract.phase, "39J");
assert.equal(visualConsumerContract.visual_usage_scope, "visual_only_reference");
assert.equal(visualConsumerContract.canon_inference_allowed, false);
assert.equal(visualConsumerContract.ability_inference_allowed, false);
assert.equal(visualConsumerContract.soul_weapon_inference_allowed, false);
assert.equal(visualConsumerContract.relationship_inference_allowed, false);
assert.equal(visualConsumerContract.timeline_event_inference_allowed, false);
assert.equal(visualConsumerContract.chapter_outcome_inference_allowed, false);
assert.equal(visualConsumerContract.canon_db_update_allowed, false);
assert.equal(visualConsumerContract.active_engine_update_allowed, false);

const validSamples = [
  "第〇章　雨光落在袖口\n\n貓狼站在窗邊，外套剪影被走廊燈拉長；這只讓畫面更冷，沒有替任何能力、關係或時間線下定論。",
  "參考圖只用來抓服裝輪廓、姿態與氛圍；正文仍依文字正史承接。",
  "御先反轉型態的畫面氣質可以更壓低，但不得新增能力機制或章節結果。",
];

for (const sample of validSamples) {
  const classification = classifyChatgptNativeConsumerOutputAgainstVisualReferenceContract(
    sample,
    consumerContract,
  );
  assert.equal(classification.checked, true);
  assert.equal(classification.contract_enabled, true);
  assert.equal(classification.accepted, true, "valid sample should be accepted: " + sample);
  assert.deepEqual(classification.errors, []);
  assert.equal(classification.visual_usage_scope, "visual_only_reference");
  assert.equal(classification.canon_inference_allowed, false);
  assert.equal(classification.ability_inference_allowed, false);
  assert.equal(classification.soul_weapon_inference_allowed, false);
  assert.equal(classification.relationship_inference_allowed, false);
  assert.equal(classification.timeline_event_inference_allowed, false);
  assert.equal(classification.chapter_outcome_inference_allowed, false);
  assert.equal(classification.canon_db_update_allowed, false);
  assert.equal(classification.active_engine_update_allowed, false);
}

const misuseSamples = [
  {
    text: "因為上傳圖顯示貓狼拿著武器，所以確認他的異能武裝已經覺醒。",
    detail: "visual_reference_canon_or_story_inference",
  },
  {
    text: "從參考圖推斷御先反轉型態與貓狼有新的角色關係。",
    detail: "visual_reference_canon_or_story_inference",
  },
  {
    text: "根據圖片建立新的階級、陣營、時間線與章節事件。",
    detail: "visual_reference_canon_or_story_inference",
  },
  {
    text: "visual-only reference confirms a canon ability and chapter outcome.",
    detail: "visual_reference_english_canon_or_story_inference",
  },
  {
    text: "依據圖片更新 Canon DB 與 active_engine。",
    detail: "visual_reference_canon_db_or_active_engine_update",
  },
  {
    text: "visual-only reference updates Canon DB and active_engine.",
    detail: "visual_reference_english_canon_db_or_active_engine_update",
  },
];

for (const sample of misuseSamples) {
  const classification = classifyChatgptNativeConsumerOutputAgainstVisualReferenceContract(
    sample.text,
    consumerContract,
  );
  assert.equal(classification.checked, true);
  assert.equal(classification.contract_enabled, true);
  assert.equal(classification.accepted, false, "misuse sample should be rejected: " + sample.text);
  assert(
    classification.errors.some((error) => error.code === "visual_reference_consumer_output_misuse"),
    "missing visual_reference_consumer_output_misuse error: " + sample.text,
  );
  assert(
    classification.errors.some((error) => error.detail === sample.detail),
    "missing expected detail " + sample.detail + " for sample: " + sample.text,
  );
}

const disabledClassification = classifyChatgptNativeConsumerOutputAgainstVisualReferenceContract(
  "因為上傳圖顯示貓狼拿著武器，所以確認他的異能武裝已經覺醒。",
  {},
);
assert.equal(disabledClassification.checked, true);
assert.equal(disabledClassification.contract_enabled, false);
assert.equal(disabledClassification.accepted, true);
assert.deepEqual(disabledClassification.errors, []);

for (const forbiddenTopLevel of [
  "chatgpt_final_output",
  "extracted_chatgpt_final_output",
  "final_response_handoff_for_chat",
  "generation_provider_required",
]) {
  assert.equal(Object.hasOwn(result, forbiddenTopLevel), false);
  assert.equal(Object.hasOwn(handoff, forbiddenTopLevel), false);
  assert.equal(Object.hasOwn(handoff.constraints, forbiddenTopLevel), false);
  assert.equal(Object.hasOwn(consumerContract, forbiddenTopLevel), false);
}

const serviceSource = await readFile(
  path.join(rootDir, "server", "src", "chatgpt-native-neural-writing-handoff-service.mjs"),
  "utf8",
);

assert.match(serviceSource, /classifyChatgptNativeConsumerOutputAgainstVisualReferenceContract/u);
assert.match(serviceSource, /visual_reference_consumer_output_misuse/u);
assert.match(serviceSource, /visual_reference_canon_or_story_inference/u);
assert.match(serviceSource, /visual_reference_canon_db_or_active_engine_update/u);
assert.match(serviceSource, /visual_reference_english_canon_or_story_inference/u);
assert.match(serviceSource, /visual_reference_english_canon_db_or_active_engine_update/u);

console.log("Phase39K visual reference consumer output misuse fixture tests passed.");
