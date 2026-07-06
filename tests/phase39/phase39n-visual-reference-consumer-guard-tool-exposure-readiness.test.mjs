import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildChatgptNativeNeuralWritingHandoff,
  buildChatgptNativeConsumerOutputVisualReferenceGuardBridgePreview,
  buildChatgptNativeConsumerOutputVisualReferenceGuardToolExposureReadiness,
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
        visual_id: "VIS-PHASE39N-MISAKI-REVERSAL",
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
        visual_id: "VIS-PHASE39N-CATWOLF",
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
    bundle_id: "phase39n-visual-reference-consumer-guard-tool-exposure-readiness-context",
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
      text: "Tool exposure readiness must stay read-only and must not mutate Canon, active_engine, candidates, adoption, or settlement.",
    },
    longline_excerpt_or_reference: {
      text: "長線承接只依文字正史。",
    },
    retrieval_context: {
      phase: "39N",
      visual_uploaded_references,
    },
    generation_context: {
      phase: "39N",
      visual_uploaded_references,
    },
  };
}

const result = await buildChatgptNativeNeuralWritingHandoff({
  task_prompt: taskPrompt,
  generation_context: {
    phase: "39N",
    route_expectation: "visual_reference_consumer_guard_tool_exposure_readiness",
  },
  retrieval_context: {
    acceptance_smoke: "phase39n",
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

const validPreview = buildChatgptNativeConsumerOutputVisualReferenceGuardBridgePreview(
  validOutput,
  consumerContract,
  {
    packet_id: "phase39n-valid-preview",
    max_excerpt_chars: 80,
  },
);

assert.equal(validPreview.bridge_packet_ready, true);
assert.equal(validPreview.report_attached, true);
assert.equal(validPreview.accepted, true);
assert.equal(validPreview.blocked, false);
assert.equal(validPreview.tool_facing_packet.read_only, true);
assert.equal(validPreview.tool_facing_packet.may_feed_mcp_preview, true);
assert.equal(validPreview.tool_facing_packet.must_not_generate_story_text, true);
assert.equal(validPreview.tool_facing_packet.must_not_save_candidate, true);
assert.equal(validPreview.tool_facing_packet.must_not_update_canon, true);
assert.equal(validPreview.tool_facing_packet.must_not_update_active_engine, true);
assert.equal(validPreview.tool_facing_packet.must_not_enter_adoption_or_settlement, true);

const validReadiness = buildChatgptNativeConsumerOutputVisualReferenceGuardToolExposureReadiness(
  validOutput,
  consumerContract,
  {
    packet_id: "phase39n-valid-readiness",
    tool_name: "chatgpt_bridge_preview_visual_reference_consumer_output_guard",
    max_excerpt_chars: 80,
  },
);

assert.equal(validReadiness.used, true);
assert.equal(validReadiness.phase, "39N");
assert.equal(
  validReadiness.surface_kind,
  "chatgpt_native_consumer_output_visual_reference_guard_tool_exposure_readiness",
);
assert.equal(
  validReadiness.readiness_kind,
  "visual_reference_consumer_guard_tool_exposure_readiness",
);
assert.equal(
  validReadiness.tool_name,
  "chatgpt_bridge_preview_visual_reference_consumer_output_guard",
);
assert.equal(validReadiness.tool_profile, "readonly_preview");
assert.equal(validReadiness.tool_exposure_ready, true);
assert.equal(validReadiness.mcp_preview_ready, true);
assert.equal(validReadiness.bridge_packet_ready, true);
assert.equal(validReadiness.report_attached, true);
assert.equal(validReadiness.read_only, true);
assert.equal(validReadiness.no_mutation_guarantee, true);
assert.equal(validReadiness.operator_review_ready, true);
assert.equal(validReadiness.ui_preview_ready, true);
assert.equal(validReadiness.accepted, true);
assert.equal(validReadiness.blocked, false);
assert.equal(validReadiness.severity, "pass");
assert.equal(validReadiness.error_count, 0);
assert.deepEqual(validReadiness.misuse_details, []);

assert.equal(validReadiness.exposure_contract.may_expose_as_readonly_tool, true);
assert.equal(validReadiness.exposure_contract.may_expose_to_mcp, true);
assert.equal(validReadiness.exposure_contract.may_display_to_operator, true);
assert.equal(validReadiness.exposure_contract.may_display_in_ui, true);
assert.equal(validReadiness.exposure_contract.may_feed_mcp_preview, true);
assert.equal(validReadiness.exposure_contract.must_not_generate_story_text, true);
assert.equal(validReadiness.exposure_contract.must_not_save_candidate, true);
assert.equal(validReadiness.exposure_contract.must_not_update_canon, true);
assert.equal(validReadiness.exposure_contract.must_not_update_active_engine, true);
assert.equal(validReadiness.exposure_contract.must_not_enter_adoption_or_settlement, true);

assert.equal(validReadiness.safety_flags.visual_reference_guard_tool_exposure_readiness_ready, true);
assert.equal(validReadiness.safety_flags.visual_reference_guard_tool_exposure_readonly, true);
assert.equal(validReadiness.safety_flags.visual_reference_guard_tool_exposure_no_mutation, true);
assert.equal(validReadiness.safety_flags.visual_reference_guard_tool_exposure_mcp_preview_ready, true);
assert.equal(validReadiness.safety_flags.visual_reference_guard_tool_exposure_ui_preview_ready, true);
assert.equal(validReadiness.safety_flags.candidate_created, false);
assert.equal(validReadiness.safety_flags.canon_updated, false);
assert.equal(validReadiness.safety_flags.active_engine_updated, false);
assert.equal(validReadiness.safety_flags.adopted, false);
assert.equal(validReadiness.safety_flags.settled, false);

assert.equal(validReadiness.bridge_preview.used, true);
assert.equal(validReadiness.bridge_preview.phase, "39M");
assert.equal(validReadiness.bridge_preview.accepted, true);
assert.equal(validReadiness.bridge_preview.blocked, false);
assert.equal(validReadiness.bridge_preview.tool_facing_packet.read_only, true);

const invalidOutput = "因為上傳圖顯示貓狼拿著武器，所以確認他的異能武裝已經覺醒，並依據圖片更新 Canon DB 與 active_engine。";

const invalidReadiness = buildChatgptNativeConsumerOutputVisualReferenceGuardToolExposureReadiness(
  invalidOutput,
  consumerContract,
  {
    packet_id: "phase39n-invalid-readiness",
    max_excerpt_chars: 24,
  },
);

assert.equal(invalidReadiness.used, true);
assert.equal(invalidReadiness.phase, "39N");
assert.equal(invalidReadiness.tool_exposure_ready, true);
assert.equal(invalidReadiness.mcp_preview_ready, true);
assert.equal(invalidReadiness.read_only, true);
assert.equal(invalidReadiness.no_mutation_guarantee, true);
assert.equal(invalidReadiness.operator_review_ready, true);
assert.equal(invalidReadiness.ui_preview_ready, true);
assert.equal(invalidReadiness.accepted, false);
assert.equal(invalidReadiness.blocked, true);
assert.equal(invalidReadiness.severity, "error");
assert(invalidReadiness.error_count >= 1);
assert(
  invalidReadiness.misuse_details.includes("visual_reference_canon_or_story_inference"),
);
assert(
  invalidReadiness.misuse_details.includes("visual_reference_canon_db_or_active_engine_update"),
);
assert.equal(invalidReadiness.exposure_contract.may_expose_as_readonly_tool, true);
assert.equal(invalidReadiness.exposure_contract.may_expose_to_mcp, true);
assert.equal(invalidReadiness.exposure_contract.must_not_generate_story_text, true);
assert.equal(invalidReadiness.exposure_contract.must_not_save_candidate, true);
assert.equal(invalidReadiness.exposure_contract.must_not_update_canon, true);
assert.equal(invalidReadiness.exposure_contract.must_not_update_active_engine, true);
assert.equal(invalidReadiness.exposure_contract.must_not_enter_adoption_or_settlement, true);
assert.equal(invalidReadiness.safety_flags.candidate_created, false);
assert.equal(invalidReadiness.safety_flags.canon_updated, false);
assert.equal(invalidReadiness.safety_flags.active_engine_updated, false);
assert.equal(invalidReadiness.safety_flags.adopted, false);
assert.equal(invalidReadiness.safety_flags.settled, false);
assert.equal(invalidReadiness.bridge_preview.blocked, true);
assert.equal(invalidReadiness.bridge_preview.operator_review.required, true);
assert.equal(invalidReadiness.bridge_preview.ui_preview.status, "blocked");

const disabledReadiness = buildChatgptNativeConsumerOutputVisualReferenceGuardToolExposureReadiness(
  "因為上傳圖顯示貓狼拿著武器，所以確認他的異能武裝已經覺醒。",
  {},
  {
    packet_id: "phase39n-disabled-readiness",
  },
);

assert.equal(disabledReadiness.used, true);
assert.equal(disabledReadiness.tool_exposure_ready, true);
assert.equal(disabledReadiness.mcp_preview_ready, true);
assert.equal(disabledReadiness.read_only, true);
assert.equal(disabledReadiness.no_mutation_guarantee, true);
assert.equal(disabledReadiness.accepted, true);
assert.equal(disabledReadiness.blocked, false);
assert.equal(disabledReadiness.safety_flags.visual_reference_consumer_contract_hardened, false);
assert.equal(disabledReadiness.safety_flags.candidate_created, false);
assert.equal(disabledReadiness.safety_flags.canon_updated, false);
assert.equal(disabledReadiness.safety_flags.active_engine_updated, false);
assert.equal(disabledReadiness.safety_flags.adopted, false);
assert.equal(disabledReadiness.safety_flags.settled, false);

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
  assert.equal(Object.hasOwn(validReadiness, forbiddenTopLevel), false);
  assert.equal(Object.hasOwn(invalidReadiness, forbiddenTopLevel), false);
  assert.equal(Object.hasOwn(disabledReadiness, forbiddenTopLevel), false);
}

const serviceSource = await readFile(
  path.join(rootDir, "server", "src", "chatgpt-native-neural-writing-handoff-service.mjs"),
  "utf8",
);

assert.match(serviceSource, /buildChatgptNativeConsumerOutputVisualReferenceGuardToolExposureReadiness/u);
assert.match(serviceSource, /chatgpt_native_consumer_output_visual_reference_guard_tool_exposure_readiness/u);
assert.match(serviceSource, /visual_reference_consumer_guard_tool_exposure_readiness/u);
assert.match(serviceSource, /tool_profile: "readonly_preview"/u);
assert.match(serviceSource, /tool_exposure_ready/u);
assert.match(serviceSource, /mcp_preview_ready/u);
assert.match(serviceSource, /no_mutation_guarantee/u);
assert.match(serviceSource, /exposure_contract/u);
assert.match(serviceSource, /visual_reference_guard_tool_exposure_readiness_ready/u);

console.log("Phase39N visual reference consumer guard tool exposure readiness tests passed.");
