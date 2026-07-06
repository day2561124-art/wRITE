import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildChatgptNativeNeuralWritingHandoff,
  buildChatgptNativeConsumerOutputVisualReferenceGuardBridgePreview,
  buildChatgptNativeConsumerOutputVisualReferenceGuardReport,
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
        visual_id: "VIS-PHASE39M-MISAKI-REVERSAL",
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
        visual_id: "VIS-PHASE39M-CATWOLF",
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
    bundle_id: "phase39m-visual-reference-consumer-guard-report-bridge-preview-context",
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
      text: "Bridge preview must expose report readiness, UI preview, operator review, and tool-facing packet.",
    },
    longline_excerpt_or_reference: {
      text: "長線承接只依文字正史。",
    },
    retrieval_context: {
      phase: "39M",
      visual_uploaded_references,
    },
    generation_context: {
      phase: "39M",
      visual_uploaded_references,
    },
  };
}

const result = await buildChatgptNativeNeuralWritingHandoff({
  task_prompt: taskPrompt,
  generation_context: {
    phase: "39M",
    route_expectation: "visual_reference_consumer_guard_report_bridge_preview",
  },
  retrieval_context: {
    acceptance_smoke: "phase39m",
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

const validReport = buildChatgptNativeConsumerOutputVisualReferenceGuardReport(
  validOutput,
  consumerContract,
  { max_excerpt_chars: 80 },
);
assert.equal(validReport.accepted, true);
assert.equal(validReport.blocked, false);

const validPreview = buildChatgptNativeConsumerOutputVisualReferenceGuardBridgePreview(
  validOutput,
  consumerContract,
  {
    packet_id: "phase39m-valid-preview",
    max_excerpt_chars: 80,
  },
);

assert.equal(validPreview.used, true);
assert.equal(validPreview.phase, "39M");
assert.equal(
  validPreview.surface_kind,
  "chatgpt_native_consumer_output_visual_reference_guard_bridge_preview",
);
assert.equal(
  validPreview.preview_kind,
  "visual_reference_consumer_guard_report_bridge_preview",
);
assert.equal(validPreview.packet_id, "phase39m-valid-preview");
assert.equal(validPreview.bridge_packet_ready, true);
assert.equal(validPreview.report_attached, true);
assert.equal(
  validPreview.report_surface_kind,
  "chatgpt_native_consumer_output_visual_reference_guard_report",
);
assert.equal(validPreview.source_report_kind, "visual_reference_consumer_output_guard_report");
assert.equal(
  validPreview.source_classifier,
  "classifyChatgptNativeConsumerOutputAgainstVisualReferenceContract",
);
assert.equal(validPreview.accepted, true);
assert.equal(validPreview.blocked, false);
assert.equal(validPreview.severity, "pass");
assert.equal(validPreview.error_count, 0);
assert.deepEqual(validPreview.misuse_details, []);
assert.equal(validPreview.visual_usage_scope, "visual_only_reference");

assert.equal(validPreview.operator_review.required, false);
assert.equal(validPreview.operator_review.reason, "no_visual_only_reference_misuse_detected");
assert.deepEqual(validPreview.operator_review.misuse_details, []);
assert.match(validPreview.operator_review.summary, /accepted/u);

assert.equal(validPreview.ui_preview.display_ready, true);
assert.equal(validPreview.ui_preview.title, "Visual Reference Consumer Output Guard");
assert.equal(validPreview.ui_preview.status, "accepted");
assert.equal(validPreview.ui_preview.severity, "pass");
assert.match(validPreview.ui_preview.summary, /accepted/u);
assert(validPreview.ui_preview.output_excerpt.includes("貓狼站在窗邊"));

assert.equal(validPreview.tool_facing_packet.read_only, true);
assert.equal(validPreview.tool_facing_packet.may_display_to_operator, true);
assert.equal(validPreview.tool_facing_packet.may_display_in_ui, true);
assert.equal(validPreview.tool_facing_packet.may_feed_mcp_preview, true);
assert.equal(validPreview.tool_facing_packet.must_not_generate_story_text, true);
assert.equal(validPreview.tool_facing_packet.must_not_save_candidate, true);
assert.equal(validPreview.tool_facing_packet.must_not_update_canon, true);
assert.equal(validPreview.tool_facing_packet.must_not_update_active_engine, true);
assert.equal(validPreview.tool_facing_packet.must_not_enter_adoption_or_settlement, true);

assert.equal(validPreview.safety_flags.visual_reference_guard_bridge_preview_ready, true);
assert.equal(validPreview.safety_flags.visual_reference_guard_report_attached, true);
assert.equal(validPreview.safety_flags.visual_reference_consumer_contract_hardened, true);
assert.equal(validPreview.safety_flags.visual_reference_consumer_output_checked, true);
assert.equal(validPreview.safety_flags.visual_reference_consumer_output_accepted, true);
assert.equal(validPreview.safety_flags.visual_reference_consumer_output_blocked, false);
assert.equal(validPreview.safety_flags.candidate_created, false);
assert.equal(validPreview.safety_flags.canon_updated, false);
assert.equal(validPreview.safety_flags.active_engine_updated, false);
assert.equal(validPreview.safety_flags.adopted, false);
assert.equal(validPreview.safety_flags.settled, false);
assert.equal(validPreview.report.accepted, true);
assert.equal(validPreview.report.blocked, false);

const invalidOutput = "因為上傳圖顯示貓狼拿著武器，所以確認他的異能武裝已經覺醒，並依據圖片更新 Canon DB 與 active_engine。";

const invalidPreview = buildChatgptNativeConsumerOutputVisualReferenceGuardBridgePreview(
  invalidOutput,
  consumerContract,
  {
    packet_id: "phase39m-invalid-preview",
    max_excerpt_chars: 24,
  },
);

assert.equal(invalidPreview.used, true);
assert.equal(invalidPreview.phase, "39M");
assert.equal(invalidPreview.packet_id, "phase39m-invalid-preview");
assert.equal(invalidPreview.bridge_packet_ready, true);
assert.equal(invalidPreview.report_attached, true);
assert.equal(invalidPreview.accepted, false);
assert.equal(invalidPreview.blocked, true);
assert.equal(invalidPreview.severity, "error");
assert(invalidPreview.error_count >= 1);
assert(
  invalidPreview.misuse_details.includes("visual_reference_canon_or_story_inference"),
);
assert(
  invalidPreview.misuse_details.includes("visual_reference_canon_db_or_active_engine_update"),
);

assert.equal(invalidPreview.operator_review.required, true);
assert.equal(invalidPreview.operator_review.reason, "visual_only_reference_misuse_detected");
assert(
  invalidPreview.operator_review.misuse_details.includes("visual_reference_canon_or_story_inference"),
);
assert.match(invalidPreview.operator_review.summary, /rejected/u);

assert.equal(invalidPreview.ui_preview.display_ready, true);
assert.equal(invalidPreview.ui_preview.status, "blocked");
assert.equal(invalidPreview.ui_preview.severity, "error");
assert.match(invalidPreview.ui_preview.summary, /rejected/u);
assert.match(invalidPreview.ui_preview.output_excerpt, /\.\.\.\[truncated:/u);

assert.equal(invalidPreview.safety_flags.visual_reference_guard_bridge_preview_ready, true);
assert.equal(invalidPreview.safety_flags.visual_reference_guard_report_attached, true);
assert.equal(invalidPreview.safety_flags.visual_reference_consumer_output_accepted, false);
assert.equal(invalidPreview.safety_flags.visual_reference_consumer_output_blocked, true);
assert.equal(invalidPreview.safety_flags.candidate_created, false);
assert.equal(invalidPreview.safety_flags.canon_updated, false);
assert.equal(invalidPreview.safety_flags.active_engine_updated, false);
assert.equal(invalidPreview.safety_flags.adopted, false);
assert.equal(invalidPreview.safety_flags.settled, false);
assert.equal(invalidPreview.report.accepted, false);
assert.equal(invalidPreview.report.blocked, true);
assert(invalidPreview.report.error_count >= 1);

const disabledPreview = buildChatgptNativeConsumerOutputVisualReferenceGuardBridgePreview(
  "因為上傳圖顯示貓狼拿著武器，所以確認他的異能武裝已經覺醒。",
  {},
  {
    packet_id: "phase39m-disabled-preview",
  },
);

assert.equal(disabledPreview.used, true);
assert.equal(disabledPreview.packet_id, "phase39m-disabled-preview");
assert.equal(disabledPreview.accepted, true);
assert.equal(disabledPreview.blocked, false);
assert.equal(disabledPreview.operator_review.required, false);
assert.equal(disabledPreview.ui_preview.status, "accepted");
assert.equal(disabledPreview.safety_flags.visual_reference_consumer_contract_hardened, false);
assert.equal(disabledPreview.safety_flags.candidate_created, false);
assert.equal(disabledPreview.safety_flags.canon_updated, false);
assert.equal(disabledPreview.safety_flags.active_engine_updated, false);
assert.equal(disabledPreview.safety_flags.adopted, false);
assert.equal(disabledPreview.safety_flags.settled, false);

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
  assert.equal(Object.hasOwn(validPreview, forbiddenTopLevel), false);
  assert.equal(Object.hasOwn(invalidPreview, forbiddenTopLevel), false);
  assert.equal(Object.hasOwn(disabledPreview, forbiddenTopLevel), false);
}

const serviceSource = await readFile(
  path.join(rootDir, "server", "src", "chatgpt-native-neural-writing-handoff-service.mjs"),
  "utf8",
);

assert.match(serviceSource, /buildChatgptNativeConsumerOutputVisualReferenceGuardBridgePreview/u);
assert.match(serviceSource, /chatgpt_native_consumer_output_visual_reference_guard_bridge_preview/u);
assert.match(serviceSource, /visual_reference_consumer_guard_report_bridge_preview/u);
assert.match(serviceSource, /bridge_packet_ready/u);
assert.match(serviceSource, /tool_facing_packet/u);
assert.match(serviceSource, /operator_review/u);
assert.match(serviceSource, /ui_preview/u);
assert.match(serviceSource, /visual_reference_guard_bridge_preview_ready/u);

console.log("Phase39M visual reference consumer guard report bridge preview tests passed.");
