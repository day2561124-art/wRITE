import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildChatgptNativeNeuralWritingHandoff,
  buildChatgptNativeConsumerOutputVisualReferenceGuardReport,
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
        visual_id: "VIS-PHASE39L-MISAKI-REVERSAL",
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
        visual_id: "VIS-PHASE39L-CATWOLF",
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
    bundle_id: "phase39l-visual-reference-consumer-output-guard-report-surface-context",
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
      text: "Guard report surface must expose accepted, errors, misuse details, and safety flags.",
    },
    longline_excerpt_or_reference: {
      text: "長線承接只依文字正史。",
    },
    retrieval_context: {
      phase: "39L",
      visual_uploaded_references,
    },
    generation_context: {
      phase: "39L",
      visual_uploaded_references,
    },
  };
}

const result = await buildChatgptNativeNeuralWritingHandoff({
  task_prompt: taskPrompt,
  generation_context: {
    phase: "39L",
    route_expectation: "visual_reference_consumer_output_guard_report_surface",
  },
  retrieval_context: {
    acceptance_smoke: "phase39l",
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
const consumerContract = handoff.chatgpt_native_consumer_contract;

assert.equal(handoff.constraints.visual_reference_final_instruction_hardened, true);
assert.equal(handoff.constraints.visual_reference_consumer_contract_hardened, true);
assert.equal(handoff.constraints.visual_reference_canon_inference_allowed, false);
assert.equal(handoff.constraints.visual_reference_active_engine_update_allowed, false);
assert.equal(handoff.constraints.visual_reference_canon_db_update_allowed, false);
assert.equal(consumerContract.visual_reference_consumer_contract_hardened, true);
assert.equal(consumerContract.visual_reference_consumer_contract.enabled, true);

const validOutput = "第〇章　雨光落在袖口\n\n貓狼站在窗邊，外套剪影被走廊燈拉長；這只讓畫面更冷，沒有替任何能力、關係或時間線下定論。";

const validClassification = classifyChatgptNativeConsumerOutputAgainstVisualReferenceContract(
  validOutput,
  consumerContract,
);
assert.equal(validClassification.accepted, true);

const validReport = buildChatgptNativeConsumerOutputVisualReferenceGuardReport(
  validOutput,
  consumerContract,
  { max_excerpt_chars: 80 },
);

assert.equal(validReport.used, true);
assert.equal(validReport.phase, "39L");
assert.equal(
  validReport.surface_kind,
  "chatgpt_native_consumer_output_visual_reference_guard_report",
);
assert.equal(validReport.report_kind, "visual_reference_consumer_output_guard_report");
assert.equal(
  validReport.source_classifier,
  "classifyChatgptNativeConsumerOutputAgainstVisualReferenceContract",
);
assert.equal(validReport.checked, true);
assert.equal(validReport.contract_enabled, true);
assert.equal(validReport.accepted, true);
assert.equal(validReport.blocked, false);
assert.equal(validReport.severity, "pass");
assert.equal(validReport.error_count, 0);
assert.deepEqual(validReport.errors, []);
assert.deepEqual(validReport.misuse_details, []);
assert.equal(validReport.visual_usage_scope, "visual_only_reference");
assert.match(validReport.operator_summary, /accepted/u);
assert(validReport.output_excerpt.includes("貓狼站在窗邊"));

assert.equal(validReport.safety_flags.visual_reference_consumer_contract_hardened, true);
assert.equal(validReport.safety_flags.visual_reference_consumer_output_checked, true);
assert.equal(validReport.safety_flags.visual_reference_consumer_output_accepted, true);
assert.equal(validReport.safety_flags.visual_reference_consumer_output_blocked, false);
assert.equal(validReport.safety_flags.canon_inference_allowed, false);
assert.equal(validReport.safety_flags.ability_inference_allowed, false);
assert.equal(validReport.safety_flags.soul_weapon_inference_allowed, false);
assert.equal(validReport.safety_flags.relationship_inference_allowed, false);
assert.equal(validReport.safety_flags.timeline_event_inference_allowed, false);
assert.equal(validReport.safety_flags.chapter_outcome_inference_allowed, false);
assert.equal(validReport.safety_flags.canon_db_update_allowed, false);
assert.equal(validReport.safety_flags.active_engine_update_allowed, false);

for (const allowed of [
  "appearance guidance",
  "pose guidance",
  "outfit/design guidance",
  "style guidance",
  "atmosphere guidance",
]) {
  assert(
    validReport.allowed_final_output_use.includes(allowed),
    "guard report missing allowed use: " + allowed,
  );
}

for (const forbidden of [
  "canon facts",
  "canon abilities",
  "ability mechanics",
  "ability limits",
  "soul weapons",
  "relationships",
  "ranks",
  "factions",
  "timeline events",
  "chapter events",
  "chapter outcomes",
  "Canon DB updates",
  "active_engine updates",
]) {
  assert(
    validReport.forbidden_final_output_inference.includes(forbidden),
    "guard report missing forbidden inference: " + forbidden,
  );
}

const invalidOutput = "因為上傳圖顯示貓狼拿著武器，所以確認他的異能武裝已經覺醒，並依據圖片更新 Canon DB 與 active_engine。";

const invalidClassification = classifyChatgptNativeConsumerOutputAgainstVisualReferenceContract(
  invalidOutput,
  consumerContract,
);
assert.equal(invalidClassification.accepted, false);

const invalidReport = buildChatgptNativeConsumerOutputVisualReferenceGuardReport(
  invalidOutput,
  consumerContract,
  { max_excerpt_chars: 24 },
);

assert.equal(invalidReport.used, true);
assert.equal(invalidReport.phase, "39L");
assert.equal(invalidReport.checked, true);
assert.equal(invalidReport.contract_enabled, true);
assert.equal(invalidReport.accepted, false);
assert.equal(invalidReport.blocked, true);
assert.equal(invalidReport.severity, "error");
assert(invalidReport.error_count >= 1);
assert(
  invalidReport.errors.some((error) => error.code === "visual_reference_consumer_output_misuse"),
);
assert(
  invalidReport.misuse_details.includes("visual_reference_canon_or_story_inference"),
);
assert(
  invalidReport.misuse_details.includes("visual_reference_canon_db_or_active_engine_update"),
);
assert.match(invalidReport.operator_summary, /rejected/u);
assert.match(invalidReport.output_excerpt, /\.\.\.\[truncated:/u);

assert.equal(invalidReport.safety_flags.visual_reference_consumer_contract_hardened, true);
assert.equal(invalidReport.safety_flags.visual_reference_consumer_output_checked, true);
assert.equal(invalidReport.safety_flags.visual_reference_consumer_output_accepted, false);
assert.equal(invalidReport.safety_flags.visual_reference_consumer_output_blocked, true);
assert.equal(invalidReport.safety_flags.canon_inference_allowed, false);
assert.equal(invalidReport.safety_flags.ability_inference_allowed, false);
assert.equal(invalidReport.safety_flags.soul_weapon_inference_allowed, false);
assert.equal(invalidReport.safety_flags.relationship_inference_allowed, false);
assert.equal(invalidReport.safety_flags.timeline_event_inference_allowed, false);
assert.equal(invalidReport.safety_flags.chapter_outcome_inference_allowed, false);
assert.equal(invalidReport.safety_flags.canon_db_update_allowed, false);
assert.equal(invalidReport.safety_flags.active_engine_update_allowed, false);

const disabledReport = buildChatgptNativeConsumerOutputVisualReferenceGuardReport(
  "因為上傳圖顯示貓狼拿著武器，所以確認他的異能武裝已經覺醒。",
  {},
);

assert.equal(disabledReport.used, true);
assert.equal(disabledReport.checked, true);
assert.equal(disabledReport.contract_enabled, false);
assert.equal(disabledReport.accepted, true);
assert.equal(disabledReport.blocked, false);
assert.equal(disabledReport.severity, "pass");
assert.equal(disabledReport.error_count, 0);
assert.deepEqual(disabledReport.errors, []);
assert.equal(disabledReport.safety_flags.visual_reference_consumer_contract_hardened, false);

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
  assert.equal(Object.hasOwn(validReport, forbiddenTopLevel), false);
  assert.equal(Object.hasOwn(invalidReport, forbiddenTopLevel), false);
}

const serviceSource = await readFile(
  path.join(rootDir, "server", "src", "chatgpt-native-neural-writing-handoff-service.mjs"),
  "utf8",
);

assert.match(serviceSource, /buildChatgptNativeConsumerOutputVisualReferenceGuardReport/u);
assert.match(serviceSource, /chatgpt_native_consumer_output_visual_reference_guard_report/u);
assert.match(serviceSource, /visual_reference_consumer_output_guard_report/u);
assert.match(serviceSource, /allowed_final_output_use/u);
assert.match(serviceSource, /forbidden_final_output_inference/u);
assert.match(serviceSource, /operator_summary/u);
assert.match(serviceSource, /visual_reference_consumer_output_blocked/u);

console.log("Phase39L visual reference consumer output guard report surface tests passed.");
