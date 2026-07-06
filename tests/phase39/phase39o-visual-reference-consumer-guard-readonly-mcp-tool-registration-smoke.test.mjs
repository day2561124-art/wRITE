import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  readonlyToolMetadata,
  readonlyTools,
} from "../../server/src/mcp-readonly-tools.mjs";
import {
  buildChatgptNativeNeuralWritingHandoff,
} from "../../server/src/chatgpt-native-neural-writing-handoff-service.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";

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

async function names(directory) {
  try {
    return new Set(await readdir(directory));
  } catch (error) {
    if (error.code === "ENOENT") return new Set();
    throw error;
  }
}

function sameSet(left, right) {
  return JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());
}

async function snapshot(paths) {
  const values = new Map();
  for (const filePath of paths) {
    try {
      values.set(filePath, await readFile(filePath));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      values.set(filePath, null);
    }
  }
  return values;
}

async function assertSnapshotUnchanged(before) {
  for (const [filePath, prior] of before) {
    try {
      const current = await readFile(filePath);
      assert.notEqual(prior, null, "File was created by readonly visual guard MCP tool: " + filePath);
      assert(current.equals(prior), "File changed after readonly visual guard MCP tool: " + filePath);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      assert.equal(prior, null, "File was removed by readonly visual guard MCP tool: " + filePath);
    }
  }
}

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
        visual_id: "VIS-PHASE39O-MISAKI-REVERSAL",
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
        visual_id: "VIS-PHASE39O-CATWOLF",
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
    bundle_id: "phase39o-visual-reference-consumer-guard-readonly-mcp-tool-registration-smoke-context",
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
      text: "Readonly MCP tool registration smoke must expose Phase39N readiness without mutation.",
    },
    longline_excerpt_or_reference: {
      text: "長線承接只依文字正史。",
    },
    retrieval_context: {
      phase: "39O",
      visual_uploaded_references,
    },
    generation_context: {
      phase: "39O",
      visual_uploaded_references,
    },
  };
}

const activeBefore = await readFile(projectPaths.activeEngine);
const pendingBefore = await names(path.join(projectPaths.canonDb, "pending_engine_candidates"));
const approvalBefore = await names(path.join(projectPaths.approvalQueue, "items"));
const cleanupBefore = await names(path.join(projectPaths.cleanupRoot, "proposals"));
const watched = await snapshot([
  projectPaths.activeEngine,
  path.join(projectPaths.outputs, "generation_context.md"),
  path.join(projectPaths.outputs, "retrieval_context.md"),
  path.join(projectPaths.outputs, "task_prompt.md"),
]);

const result = await buildChatgptNativeNeuralWritingHandoff({
  task_prompt: taskPrompt,
  generation_context: {
    phase: "39O",
    route_expectation: "visual_reference_consumer_guard_readonly_mcp_tool_registration_smoke",
  },
  retrieval_context: {
    acceptance_smoke: "phase39o",
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
assert.equal(consumerContract.visual_reference_consumer_contract_hardened, true);
assert.equal(consumerContract.visual_reference_consumer_contract.enabled, true);

assert.equal(typeof readonlyTools.preview_visual_reference_consumer_output_guard, "function");

const metadata = readonlyToolMetadata.preview_visual_reference_consumer_output_guard;
assert(metadata, "preview_visual_reference_consumer_output_guard metadata missing.");
assert.equal(metadata.permission, "read_only");
assert.equal(metadata.writes_files, false);
assert.equal(metadata.can_modify_active_engine, false);
assert.equal(metadata.requires_user_confirmation, false);

const validOutput = "第〇章　雨光落在袖口\n\n貓狼站在窗邊，外套剪影被走廊燈拉長；這只讓畫面更冷，沒有替任何能力、關係或時間線下定論。";

const validToolResult = await readonlyTools.preview_visual_reference_consumer_output_guard({
  output_text: validOutput,
  consumer_contract: consumerContract,
  packet_id: "phase39o-valid-mcp-preview",
  max_excerpt_chars: 80,
});

assert.equal(validToolResult.ok, true);
assert.equal(validToolResult.tool_name, "preview_visual_reference_consumer_output_guard");
assert.equal(validToolResult.canon_status, "readonly_preview");
assert.equal(validToolResult.blocked, false);
assert.equal(validToolResult.blocked_reason, null);
assert.deepEqual(validToolResult.sources, []);
assert.deepEqual(validToolResult.warnings, []);

assert.equal(validToolResult.data.used, true);
assert.equal(validToolResult.data.phase, "39N");
assert.equal(
  validToolResult.data.surface_kind,
  "chatgpt_native_consumer_output_visual_reference_guard_tool_exposure_readiness",
);
assert.equal(validToolResult.data.tool_name, "chatgpt_bridge_preview_visual_reference_consumer_output_guard");
assert.equal(validToolResult.data.tool_profile, "readonly_preview");
assert.equal(validToolResult.data.tool_exposure_ready, true);
assert.equal(validToolResult.data.mcp_preview_ready, true);
assert.equal(validToolResult.data.bridge_packet_ready, true);
assert.equal(validToolResult.data.report_attached, true);
assert.equal(validToolResult.data.read_only, true);
assert.equal(validToolResult.data.no_mutation_guarantee, true);
assert.equal(validToolResult.data.operator_review_ready, true);
assert.equal(validToolResult.data.ui_preview_ready, true);
assert.equal(validToolResult.data.accepted, true);
assert.equal(validToolResult.data.blocked, false);
assert.equal(validToolResult.data.severity, "pass");
assert.equal(validToolResult.data.error_count, 0);
assert.deepEqual(validToolResult.data.misuse_details, []);
assert.equal(validToolResult.data.active_canon, false);
assert.equal(validToolResult.data.mcp_tool_registered, true);
assert.equal(validToolResult.data.mcp_tool_permission, "read_only");
assert.equal(validToolResult.data.mcp_tool_writes_files, false);
assert.equal(validToolResult.data.mcp_tool_can_modify_active_engine, false);
assert.equal(validToolResult.data.mcp_tool_requires_user_confirmation, false);

assert.equal(validToolResult.data.exposure_contract.may_expose_as_readonly_tool, true);
assert.equal(validToolResult.data.exposure_contract.may_expose_to_mcp, true);
assert.equal(validToolResult.data.exposure_contract.must_not_generate_story_text, true);
assert.equal(validToolResult.data.exposure_contract.must_not_save_candidate, true);
assert.equal(validToolResult.data.exposure_contract.must_not_update_canon, true);
assert.equal(validToolResult.data.exposure_contract.must_not_update_active_engine, true);
assert.equal(validToolResult.data.exposure_contract.must_not_enter_adoption_or_settlement, true);

assert.equal(validToolResult.data.safety_flags.visual_reference_guard_tool_exposure_readiness_ready, true);
assert.equal(validToolResult.data.safety_flags.visual_reference_guard_tool_exposure_readonly, true);
assert.equal(validToolResult.data.safety_flags.visual_reference_guard_tool_exposure_no_mutation, true);
assert.equal(validToolResult.data.safety_flags.visual_reference_guard_tool_exposure_mcp_preview_ready, true);
assert.equal(validToolResult.data.safety_flags.candidate_created, false);
assert.equal(validToolResult.data.safety_flags.canon_updated, false);
assert.equal(validToolResult.data.safety_flags.active_engine_updated, false);
assert.equal(validToolResult.data.safety_flags.adopted, false);
assert.equal(validToolResult.data.safety_flags.settled, false);
assert.equal(validToolResult.data.bridge_preview.used, true);
assert.equal(validToolResult.data.bridge_preview.phase, "39M");
assert.equal(validToolResult.data.bridge_preview.accepted, true);
assert.equal(validToolResult.data.bridge_preview.tool_facing_packet.read_only, true);

const invalidOutput = "因為上傳圖顯示貓狼拿著武器，所以確認他的異能武裝已經覺醒，並依據圖片更新 Canon DB 與 active_engine。";

const invalidToolResult = await readonlyTools.preview_visual_reference_consumer_output_guard({
  outputText: invalidOutput,
  consumerContract,
  packetId: "phase39o-invalid-mcp-preview",
  maxExcerptChars: 24,
});

assert.equal(invalidToolResult.ok, true);
assert.equal(invalidToolResult.tool_name, "preview_visual_reference_consumer_output_guard");
assert.equal(invalidToolResult.canon_status, "readonly_preview");
assert.equal(invalidToolResult.blocked, false);
assert.equal(invalidToolResult.data.tool_exposure_ready, true);
assert.equal(invalidToolResult.data.mcp_preview_ready, true);
assert.equal(invalidToolResult.data.read_only, true);
assert.equal(invalidToolResult.data.no_mutation_guarantee, true);
assert.equal(invalidToolResult.data.accepted, false);
assert.equal(invalidToolResult.data.blocked, true);
assert.equal(invalidToolResult.data.severity, "error");
assert(invalidToolResult.data.error_count >= 1);
assert(
  invalidToolResult.data.misuse_details.includes("visual_reference_canon_or_story_inference"),
);
assert(
  invalidToolResult.data.misuse_details.includes("visual_reference_canon_db_or_active_engine_update"),
);
assert.equal(invalidToolResult.data.exposure_contract.may_expose_as_readonly_tool, true);
assert.equal(invalidToolResult.data.exposure_contract.may_expose_to_mcp, true);
assert.equal(invalidToolResult.data.exposure_contract.must_not_generate_story_text, true);
assert.equal(invalidToolResult.data.exposure_contract.must_not_save_candidate, true);
assert.equal(invalidToolResult.data.exposure_contract.must_not_update_canon, true);
assert.equal(invalidToolResult.data.exposure_contract.must_not_update_active_engine, true);
assert.equal(invalidToolResult.data.exposure_contract.must_not_enter_adoption_or_settlement, true);
assert.equal(invalidToolResult.data.safety_flags.candidate_created, false);
assert.equal(invalidToolResult.data.safety_flags.canon_updated, false);
assert.equal(invalidToolResult.data.safety_flags.active_engine_updated, false);
assert.equal(invalidToolResult.data.safety_flags.adopted, false);
assert.equal(invalidToolResult.data.safety_flags.settled, false);
assert.equal(invalidToolResult.data.bridge_preview.blocked, true);
assert.equal(invalidToolResult.data.bridge_preview.operator_review.required, true);
assert.equal(invalidToolResult.data.bridge_preview.ui_preview.status, "blocked");

const disabledToolResult = await readonlyTools.preview_visual_reference_consumer_output_guard({
  output_text: invalidOutput,
  consumer_contract: {},
  packet_id: "phase39o-disabled-mcp-preview",
});

assert.equal(disabledToolResult.ok, true);
assert.equal(disabledToolResult.data.tool_exposure_ready, true);
assert.equal(disabledToolResult.data.mcp_preview_ready, true);
assert.equal(disabledToolResult.data.read_only, true);
assert.equal(disabledToolResult.data.no_mutation_guarantee, true);
assert.equal(disabledToolResult.data.accepted, true);
assert.equal(disabledToolResult.data.blocked, false);
assert.equal(disabledToolResult.data.safety_flags.visual_reference_consumer_contract_hardened, false);
assert.equal(disabledToolResult.data.safety_flags.candidate_created, false);
assert.equal(disabledToolResult.data.safety_flags.canon_updated, false);
assert.equal(disabledToolResult.data.safety_flags.active_engine_updated, false);
assert.equal(disabledToolResult.data.safety_flags.adopted, false);
assert.equal(disabledToolResult.data.safety_flags.settled, false);

await assertSnapshotUnchanged(watched);
assert((await readFile(projectPaths.activeEngine)).equals(activeBefore), "Readonly MCP preview changed active_engine.");
assert(
  sameSet(await names(path.join(projectPaths.canonDb, "pending_engine_candidates")), pendingBefore),
  "Readonly MCP preview changed pending candidates.",
);
assert(
  sameSet(await names(path.join(projectPaths.approvalQueue, "items")), approvalBefore),
  "Readonly MCP preview changed approval queue.",
);
assert(
  sameSet(await names(path.join(projectPaths.cleanupRoot, "proposals")), cleanupBefore),
  "Readonly MCP preview changed cleanup proposals.",
);

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
  assert.equal(Object.hasOwn(validToolResult.data, forbiddenTopLevel), false);
  assert.equal(Object.hasOwn(invalidToolResult.data, forbiddenTopLevel), false);
  assert.equal(Object.hasOwn(disabledToolResult.data, forbiddenTopLevel), false);
}

const readonlySource = await readFile(
  path.join(rootDir, "server", "src", "mcp-readonly-tools.mjs"),
  "utf8",
);

assert.match(readonlySource, /preview_visual_reference_consumer_output_guard/u);
assert.match(readonlySource, /buildChatgptNativeConsumerOutputVisualReferenceGuardToolExposureReadiness/u);
assert.match(readonlySource, /chatgpt_bridge_preview_visual_reference_consumer_output_guard/u);
assert.match(readonlySource, /mcp_tool_registered/u);
assert.match(readonlySource, /mcp_tool_permission/u);
assert.match(readonlySource, /mcp_tool_writes_files/u);
assert.match(readonlySource, /mcp_tool_can_modify_active_engine/u);

console.log("Phase39O visual reference consumer guard readonly MCP tool registration smoke tests passed.");
