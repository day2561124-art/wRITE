import assert from "node:assert/strict";
import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { buildChatgptNativeNeuralWritingHandoff } from "../../server/src/chatgpt-native-neural-writing-handoff-service.mjs";
import { projectRoot } from "../../server/src/project-paths.mjs";

const fixtureRoot = path.join(
  projectRoot,
  "tests",
  ".tmp",
  "phase38h-chatgpt-native-handoff",
);
await rm(fixtureRoot, { recursive: true, force: true });
await mkdir(fixtureRoot, { recursive: true });

const fakeBundle = {
  bundle_id: "phase38h-test-bundle",
  bundle_kind: "gpt_writing_context",
  task_prompt: "依最新主核對表正式續寫下一章。只輸出正文，從章名開始。",
  output_mode: "chat_only",
  for_chat_output: true,
  engine_first: true,
  engine_components_valid: true,
  neural_pipeline_required: true,
  required_neural_modules: [
    "run_scene_planner",
    "run_character_simulator",
    "run_neural_critic",
    "run_style_drift_detector",
    "run_over_governance_detector",
  ],
  engine_components_status: {
    components: {
      neural_pipeline: {
        required: true,
        modules: [
          { name: "run_scene_planner", required_status: "available" },
          { name: "run_character_simulator", required_status: "available" },
          { name: "run_neural_critic", required_status: "available" },
          { name: "run_style_drift_detector", required_status: "available" },
          { name: "run_over_governance_detector", required_status: "available" },
        ],
      },
    },
  },
  formal_context: {
    context_kind: "formal_writing_context",
    user_request: "依最新主核對表正式續寫下一章。只輸出正文，從章名開始。",
    active_engine_metadata: {
      path: "data/canon_db/active_engine.md",
      sha256: "a".repeat(64),
      full_text_included: false,
    },
    materials: {
      generation_context: { chapter_goal: "continue" },
      retrieval_context: { latest_main_checklist: "loaded" },
    },
  },
  allocated: {
    active_engine_excerpt_or_reference: { text: "active_engine excerpt: engine-first neural writing context." },
    writing_card_excerpt_or_reference: { text: "writing card excerpt: write vivid long-form prose." },
    proofing_card_excerpt_or_reference: { text: "proofing card excerpt: avoid canon drift." },
    longline_excerpt_or_reference: { text: "longline excerpt: modern high-tech spiritual academy ensemble fantasy." },
    character_voice_registry_content: { text: "character voice registry excerpt: preserve living character voices." },
    retrieval_context: { text: "{\"latest_main_checklist\":\"loaded\"}" },
    generation_context: { text: "{\"chapter_goal\":\"continue\"}" },
    aesthetic_memory_context: { text: "aesthetic memory excerpt: no administrative prose." },
    character_state_context: { text: "character state excerpt: ensemble cast active." },
    foreshadowing_context: { text: "foreshadowing excerpt: unresolved door motif pressure." },
    reader_simulator_context: { text: "reader simulator excerpt: maintain momentum." },
  },
};

let receivedContextInput = null;

const result = await buildChatgptNativeNeuralWritingHandoff({
  task_prompt: fakeBundle.task_prompt,
  generation_context: { chapter_goal: "continue" },
  retrieval_context: { latest_main_checklist: "loaded" },
  provider_type: "local_http",
  save_candidate: true,
  output_mode: "chatgpt_native_handoff",
}, {
  buildGptWritingContextFn: async (input) => {
    receivedContextInput = input;
    return { bundle: fakeBundle };
  },
  fixtureRoot,
});

assert.equal(receivedContextInput.output_mode, "chat_only");
assert.equal(receivedContextInput.task_prompt, fakeBundle.task_prompt);
assert.equal(receivedContextInput.include_active_engine, false);
assert.equal(receivedContextInput.include_proofing_card, false);
assert.equal(result.tool_name, "chatgpt_bridge_build_full_neural_writing_handoff");
assert.equal(result.status, "ready_for_chatgpt_native_generation");
assert.equal(result.output_mode, "chatgpt_native_handoff");
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
assert.match(handoff.final_chatgpt_writing_instruction, /ChatGPT 原生正文生成器/u);
assert.match(handoff.final_chatgpt_writing_instruction, /不要要求使用者啟動 local generation provider/u);
assert.equal(handoff.constraints.tool_must_not_generate_story_text, true);
assert.equal(handoff.constraints.chatgpt_must_generate_after_handoff, true);
assert.equal(handoff.constraints.save_candidate, false);
assert.equal(handoff.constraints.canon_update_allowed, false);
assert.equal(handoff.constraints.active_engine_update_allowed, false);
assert.equal(handoff.constraints.backend_provider_required, false);
assert.equal(handoff.neural_modules_diagnostics.required_modules_checked, true);
assert.equal(handoff.neural_modules_diagnostics.contract_valid, true);
assert.deepEqual(handoff.neural_modules_diagnostics.missing_required_modules, []);
assert.equal(
  handoff.writing_context.active_engine_metadata.full_text_included,
  false,
);
assert.equal(
  handoff.writing_context.active_engine_metadata.sha256,
  "a".repeat(64),
);
assert.equal(handoff.creative_authority.owner, "ChatGPT");
assert.equal(handoff.external_research.authority, "reference_only");
assert.equal(
  JSON.stringify(handoff.writing_context).includes(
    "active_engine excerpt",
  ),
  false,
);
const resultByModule = Object.fromEntries(
  handoff.neural_module_execution_results.map((item) => [
    item.canonical_module_name,
    item,
  ]),
);
assert.match(
  resultByModule.neural_critic.result_excerpt,
  /inactive_without_draft_evidence/u,
);
assert.match(
  resultByModule.style_drift_detector.result_excerpt,
  /inactive_without_draft_evidence/u,
);
assert.match(
  resultByModule.final_polisher.result_excerpt,
  /final_polisher_requires_existing_draft_text/u,
);

const serialized = JSON.stringify(result);
assert.equal(serialized.includes('"pipeline_stage":"generation_provider_required"'), false);
assert.equal(serialized.includes("chatgpt_final_output"), false);
assert.equal(serialized.includes("extracted_chatgpt_final_output"), false);
assert.equal(serialized.includes("final_response_handoff_for_chat"), false);

const bridgeSource = await readFile(new URL("../../server/src/mcp-chatgpt-bridge-tools.mjs", import.meta.url), "utf8");
assert.match(bridgeSource, /chatgpt_bridge_build_full_neural_writing_handoff/u);
assert.match(bridgeSource, /buildChatgptNativeNeuralWritingHandoff/u);

const serverSource = await readFile(new URL("../../server/src/mcp-server.mjs", import.meta.url), "utf8");
assert.match(serverSource, /name: "chatgpt_bridge_build_full_neural_writing_handoff"/u);
assert.match(serverSource, /ChatGPT-native full neural writing handoff/u);
assert.match(serverSource, /chatgpt_bridge_build_full_neural_writing_handoff: \[/u);

const toolDefinitionStart = serverSource.indexOf('name: "chatgpt_bridge_build_full_neural_writing_handoff"');
const toolDefinitionEnd = serverSource.indexOf('name: "chatgpt_bridge_run_full_neural_writing_pipeline"', toolDefinitionStart);
const nativeToolDefinition = serverSource.slice(toolDefinitionStart, toolDefinitionEnd);
assert.equal(nativeToolDefinition.includes("provider_type"), false);
assert.equal(nativeToolDefinition.includes("generation_provider"), false);

const runAllSource = await readFile(new URL("../run-all.mjs", import.meta.url), "utf8");
assert.match(runAllSource, /Phase 38H ChatGPT native full neural writing handoff mode/u);

await rm(fixtureRoot, { recursive: true, force: true });
console.log("Phase38H ChatGPT native full neural writing handoff mode tests passed.");
