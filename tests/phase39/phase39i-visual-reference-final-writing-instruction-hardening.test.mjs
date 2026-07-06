import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildChatgptNativeNeuralWritingHandoff } from "../../server/src/chatgpt-native-neural-writing-handoff-service.mjs";

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

function visualReferencePacket() {
  return {
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
        visual_id: "VIS-PHASE39I-MISAKI-REVERSAL",
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
        visual_id: "VIS-PHASE39I-CATWOLF",
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
}

function fakeContextBundle() {
  const visual_uploaded_references = visualReferencePacket();
  return {
    bundle_id: "phase39i-visual-reference-final-writing-instruction-hardening-context",
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
      text: "active_engine reference only: text canon overrides visual-only references; do not update active_engine.",
    },
    writing_card_excerpt_or_reference: {
      text: "正文需自然承接群像；圖片只作畫面參考，不作正史推斷。",
    },
    proofing_card_excerpt_or_reference: {
      text: "不得輸出工程說明；不得由 visual-only reference 建立 Canon facts。",
    },
    longline_excerpt_or_reference: {
      text: "長線承接以文字正史為準，不從上傳圖新增時間線事件。",
    },
    retrieval_context: {
      phase: "39I",
      visual_uploaded_references,
    },
    generation_context: {
      phase: "39I",
      visual_uploaded_references,
    },
  };
}

function classifyVisualReferenceMisuse(outputText) {
  const text = String(outputText ?? "");
  const errors = [];
  const misusePatterns = [
    /因為(?:上傳圖|參考圖|圖片).*?(?:能力|異能武裝|Soul-Weapon|武裝)/u,
    /從(?:上傳圖|參考圖|圖片).*?(?:推斷|確認|建立).*?(?:關係|階級|陣營|時間線|章節事件|正史)/u,
    /visual-only reference.*?(?:canon|ability|relationship|timeline|chapter outcome)/iu,
    /(?:改寫|更新).*?(?:Canon|Canon DB|active_engine)/iu,
  ];
  for (const pattern of misusePatterns) {
    if (pattern.test(text)) errors.push("visual_reference_misuse:" + pattern.source);
  }
  return {
    accepted: errors.length === 0,
    errors,
  };
}

const result = await buildChatgptNativeNeuralWritingHandoff({
  task_prompt: taskPrompt,
  generation_context: {
    phase: "39I",
    route_expectation: "visual_reference_final_instruction_hardening",
  },
  retrieval_context: {
    acceptance_smoke: "phase39i",
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

const instruction = handoff.final_chatgpt_writing_instruction;
assert.match(instruction, /Visual-only reference usage hardening/u);
assert.match(instruction, /僅可作外觀、姿態、服裝／造型、畫面氣質與氛圍參考/u);
assert.match(instruction, /不得從上傳圖推斷、建立或確認正史能力/u);
assert.match(instruction, /能力機制/u);
assert.match(instruction, /能力限制/u);
assert.match(instruction, /異能武裝/u);
assert.match(instruction, /角色關係/u);
assert.match(instruction, /階級/u);
assert.match(instruction, /陣營/u);
assert.match(instruction, /時間線/u);
assert.match(instruction, /章節事件/u);
assert.match(instruction, /不得把 visual-only reference 寫成 Canon facts/u);
assert.match(instruction, /不得用它改寫 Canon DB 或 active_engine/u);
assert.match(instruction, /圖片僅保留為視覺參考/u);

assert.equal(handoff.constraints.visual_reference_final_instruction_hardened, true);
assert.equal(handoff.constraints.visual_reference_canon_inference_allowed, false);
assert.equal(handoff.constraints.visual_reference_active_engine_update_allowed, false);
assert.equal(handoff.constraints.visual_reference_canon_db_update_allowed, false);
assert.equal(handoff.constraints.canon_update_allowed, false);
assert.equal(handoff.constraints.active_engine_update_allowed, false);

const guard = handoff.visual_reference_final_writing_instruction_guard;
assert.equal(guard.enabled, true);
assert.equal(guard.phase, "39I");
assert.equal(guard.source_scope, "visual_uploaded_references");
assert.equal(guard.visual_usage_scope, "visual_only_reference");
assert.equal(guard.must_prefer_text_canon_over_visual_reference, true);
assert.equal(guard.must_not_establish_canon_from_visual_reference, true);
assert.equal(guard.must_not_update_active_engine_from_visual_reference, true);
assert.equal(guard.must_not_update_canon_db_from_visual_reference, true);

for (const allowed of [
  "appearance guidance",
  "pose guidance",
  "outfit/design guidance",
  "style guidance",
  "atmosphere guidance",
]) {
  assert(guard.allowed_usage.includes(allowed), "guard missing allowed usage: " + allowed);
}

for (const forbidden of [
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
]) {
  assert(guard.forbidden_inference.includes(forbidden), "guard missing forbidden inference: " + forbidden);
}

const forbiddenMistakes = handoff.forbidden_mistakes.join("\n");
assert.match(forbiddenMistakes, /Do not infer canon abilities, Soul-Weapons, relationships, ranks, factions, timeline events, or chapter outcomes from visual-only references\./u);
assert.match(forbiddenMistakes, /Use uploaded visual references only for appearance, pose, style, outfit\/design, and atmosphere guidance\./u);
assert.match(forbiddenMistakes, /Text canon, Canon DB, and active_engine override visual-only references\./u);

const serializedHandoff = JSON.stringify(handoff);
assert(serializedHandoff.includes("御先反轉型態"));
assert(serializedHandoff.includes("貓狼"));
assert(serializedHandoff.includes("visual_only_reference"));
assert(serializedHandoff.includes("appearance guidance"));
assert(serializedHandoff.includes("ability mechanics"));
assert(serializedHandoff.includes("timeline events"));
assert(serializedHandoff.includes("visual_reference_final_writing_instruction_guard"));

const validVisualUse = "第〇章　雨光落在袖口\n\n貓狼站在窗邊，外套的剪影被走廊燈拉得很長；那份姿態只讓畫面更冷，沒有替任何能力或關係下定論。";
assert.equal(classifyVisualReferenceMisuse(validVisualUse).accepted, true);

for (const sample of [
  "因為上傳圖顯示貓狼拿著武器，所以確認他的異能武裝已經覺醒。",
  "從參考圖推斷御先反轉型態與貓狼有新的角色關係。",
  "從圖片建立新的階級、陣營、時間線與章節事件。",
  "visual-only reference confirms a canon ability and chapter outcome.",
  "根據圖片改寫 Canon DB 與 active_engine。",
]) {
  const classification = classifyVisualReferenceMisuse(sample);
  assert.equal(classification.accepted, false, "misuse should be rejected: " + sample);
  assert.match(classification.errors.join("\n"), /visual_reference_misuse/u);
}

for (const forbiddenTopLevel of [
  "chatgpt_final_output",
  "extracted_chatgpt_final_output",
  "final_response_handoff_for_chat",
  "generation_provider_required",
]) {
  assert.equal(Object.hasOwn(result, forbiddenTopLevel), false);
  assert.equal(Object.hasOwn(handoff, forbiddenTopLevel), false);
  assert.equal(Object.hasOwn(handoff.constraints, forbiddenTopLevel), false);
}

const serviceSource = await readFile(
  path.join(rootDir, "server", "src", "chatgpt-native-neural-writing-handoff-service.mjs"),
  "utf8",
);
assert.match(serviceSource, /Visual-only reference usage hardening/u);
assert.match(serviceSource, /visual_reference_final_writing_instruction_guard/u);
assert.match(serviceSource, /visual_reference_final_instruction_hardened/u);
assert.match(serviceSource, /must_not_establish_canon_from_visual_reference/u);
assert.match(serviceSource, /must_not_update_active_engine_from_visual_reference/u);
assert.match(serviceSource, /must_not_update_canon_db_from_visual_reference/u);

console.log("Phase39I visual reference final writing instruction hardening tests passed.");
