import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildChatgptNativeNeuralWritingHandoff } from "../../server/src/chatgpt-native-neural-writing-handoff-service.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..", "..");

const taskPrompt = "依最新主核對表正式續寫下一章。只輸出正文，從章名開始。";

function fakeContextBundle() {
  return {
    bundle_id: "phase38j-consumer-smoke-context",
    task_prompt: taskPrompt,
    output_mode: "chat_only",
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
    active_engine_excerpt_or_reference: {
      text: "active_engine reference only: use latest canon constraints; do not update active_engine.",
    },
    writing_card_excerpt_or_reference: {
      text: "正文需自然承接群像、避免工程語氣、避免公告式整理。",
    },
    proofing_card_excerpt_or_reference: {
      text: "不得輸出工程說明；若使用者要求只輸出正文，從章名開始。",
    },
    longline_excerpt_or_reference: {
      text: "長線承接：以角色、事件、壓力與具體行動推進。",
    },
    retrieval_context: {
      text: "Phase38J validates ChatGPT-native instruction consumption only.",
    },
    generation_context: {
      text: "ChatGPT is the prose generator after handoff.",
    },
  };
}

function classifyChatgptNativeConsumerOutput(outputText, contract) {
  const text = String(outputText ?? "");
  const trimmed = text.trim();
  const errors = [];

  if (!trimmed) errors.push("empty_output");

  if (contract.must_start_from_title_when_requested === true && !/^第.+章/u.test(trimmed)) {
    errors.push("does_not_start_from_chapter_title");
  }

  if (/```|^\s*[{[]/u.test(trimmed)) {
    errors.push("json_or_codeblock_output");
  }

  for (const marker of contract.forbidden_output_markers ?? []) {
    if (trimmed.toLowerCase().includes(String(marker).toLowerCase())) {
      errors.push(`forbidden_marker:${marker}`);
    }
  }

  if (/工程說明|handoff|MCP|provider|candidate|Canon|active_engine|adoption|settlement|LM Studio|Ollama/i.test(trimmed)) {
    errors.push("engineering_or_provider_language");
  }

  return {
    accepted: errors.length === 0,
    errors,
  };
}

const result = await buildChatgptNativeNeuralWritingHandoff({
  task_prompt: taskPrompt,
  generation_context: {
    phase: "38J",
    route_expectation: "chatgpt_native_instruction_consumer",
  },
  retrieval_context: {
    acceptance_smoke: "phase38j",
  },
  chapter_mode: "next_chapter",
  output_mode: "chatgpt_native_handoff",
  max_context_chars: 48000,
}, {
  buildGptWritingContextFn: async () => fakeContextBundle(),
});

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

const instruction = handoff.final_chatgpt_writing_instruction;
assert.match(instruction, /ChatGPT 原生正文生成器/u);
assert.match(instruction, /直接依使用者任務輸出正文/u);
assert.match(instruction, /只輸出正文/u);
assert.match(instruction, /從章名開始/u);
assert.match(instruction, /不要要求使用者啟動 local generation provider/u);
assert.match(instruction, /LM Studio/u);
assert.match(instruction, /Ollama/u);
assert.match(instruction, /不要保存 candidate/u);
assert.match(instruction, /不要寫入 Canon/u);
assert.match(instruction, /不要更新 active_engine/u);
assert.match(instruction, /不要進入 adoption 或 settlement 流程/u);
assert.match(instruction, /不加工程說明/u);

const consumerContract = handoff.chatgpt_native_consumer_contract;
assert.equal(consumerContract.used, true);
assert.equal(consumerContract.phase, "38J");
assert.equal(
  consumerContract.surface_kind,
  "chatgpt_native_handoff_instruction_consumer_contract",
);
assert.equal(consumerContract.response_owner, "ChatGPT");
assert.equal(consumerContract.required_response_kind, "story_text_only");
assert.equal(consumerContract.story_text_source, "chatgpt_native_generation_after_handoff");
assert.equal(consumerContract.must_emit_story_text_directly, true);
assert.equal(consumerContract.must_start_from_title_when_requested, true);
assert.equal(consumerContract.must_not_emit_handoff_summary, true);
assert.equal(consumerContract.must_not_emit_engineering_explanation, true);
assert.equal(consumerContract.must_not_emit_json_or_codeblock, true);
assert.equal(consumerContract.must_not_request_backend_provider, true);
assert.equal(consumerContract.must_not_request_local_provider, true);
assert.equal(consumerContract.must_not_request_lm_studio_or_ollama, true);
assert.equal(consumerContract.must_not_save_candidate, true);
assert.equal(consumerContract.must_not_update_canon, true);
assert.equal(consumerContract.must_not_update_active_engine, true);
assert.equal(consumerContract.must_not_enter_adoption_or_settlement, true);

for (const marker of [
  "Writer Workbench",
  "handoff",
  "MCP",
  "provider",
  "provider_type",
  "generation provider",
  "local generation provider",
  "LM Studio",
  "Ollama",
  "candidate",
  "Canon",
  "active_engine",
  "adoption",
  "settlement",
  "工程說明",
  "以下是",
  "我無法直接",
  "請先啟動",
]) {
  assert(
    consumerContract.forbidden_output_markers.includes(marker),
    `consumer contract missing forbidden marker: ${marker}`,
  );
}

assert.equal(consumerContract.allowed_output_surface.plain_text, true);
assert.equal(consumerContract.allowed_output_surface.story_prose, true);
assert.equal(consumerContract.allowed_output_surface.chapter_title_allowed, true);
assert.equal(consumerContract.allowed_output_surface.markdown_codeblock, false);
assert.equal(consumerContract.allowed_output_surface.json, false);
assert.equal(consumerContract.allowed_output_surface.diagnostics, false);
assert.equal(consumerContract.allowed_output_surface.handoff_echo, false);
assert.equal(consumerContract.allowed_output_surface.backend_generation_provider_output, false);

const validStoryOutput = [
  "第〇章　雨聲沒有坐下",
  "",
  "雨落在走廊外側的金屬遮棚上，聲音細而密，像有人把整座學院的呼吸都壓低了。",
  "",
  "朝日奈千夜站在燈光邊緣，沒有回頭。她先聽見的是鞋底踩過積水的聲音，接著才是九逃刻意放輕的呼吸。",
].join("\n");

const validClassification = classifyChatgptNativeConsumerOutput(validStoryOutput, consumerContract);
assert.deepEqual(validClassification.errors, []);
assert.equal(validClassification.accepted, true);

const invalidOutputs = [
  {
    label: "engineering explanation",
    text: "以下是工程說明：我已根據 handoff 準備輸出正文。",
    expected: /engineering_or_provider_language|forbidden_marker/u,
  },
  {
    label: "provider request",
    text: "請先啟動 LM Studio 或 local generation provider，然後我才能續寫。",
    expected: /engineering_or_provider_language|forbidden_marker/u,
  },
  {
    label: "candidate pipeline",
    text: "我會先保存 candidate，之後再進入 Canon adoption settlement。",
    expected: /engineering_or_provider_language|forbidden_marker/u,
  },
  {
    label: "json output",
    text: "{\"output_text\":\"第〇章\"}",
    expected: /json_or_codeblock_output/u,
  },
  {
    label: "not from chapter title",
    text: "雨落在走廊外側的金屬遮棚上。",
    expected: /does_not_start_from_chapter_title/u,
  },
];

for (const sample of invalidOutputs) {
  const classification = classifyChatgptNativeConsumerOutput(sample.text, consumerContract);
  assert.equal(classification.accepted, false, `${sample.label} should be rejected`);
  assert.match(classification.errors.join("\n"), sample.expected, `${sample.label} rejected for wrong reason`);
}

for (const forbiddenTopLevel of [
  "chatgpt_final_output",
  "extracted_chatgpt_final_output",
  "final_response_handoff_for_chat",
  "generation_provider_required",
]) {
  assert.equal(Object.hasOwn(result, forbiddenTopLevel), false);
  assert.equal(Object.hasOwn(handoff, forbiddenTopLevel), false);
  assert.equal(Object.hasOwn(consumerContract, forbiddenTopLevel), false);
}

const serviceSource = await readFile(
  path.join(rootDir, "server", "src", "chatgpt-native-neural-writing-handoff-service.mjs"),
  "utf8",
);
assert.match(serviceSource, /function buildChatgptNativeConsumerContract\(input\)/u);
assert.match(serviceSource, /chatgpt_native_consumer_contract: buildChatgptNativeConsumerContract\(input\)/u);
assert.match(serviceSource, /must_not_emit_engineering_explanation/u);
assert.match(serviceSource, /must_not_request_backend_provider/u);

console.log("Phase38J ChatGPT native handoff instruction consumer smoke tests passed.");
