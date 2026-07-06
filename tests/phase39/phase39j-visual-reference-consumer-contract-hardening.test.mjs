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
        visual_id: "VIS-PHASE39J-MISAKI-REVERSAL",
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
        visual_id: "VIS-PHASE39J-CATWOLF",
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
    bundle_id: "phase39j-visual-reference-consumer-contract-hardening-context",
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
      text: "正文可使用圖片的外觀、姿態、服裝與氛圍，但不得用圖片建立正史或能力設定。",
    },
    proofing_card_excerpt_or_reference: {
      text: "final output consumer must not infer Canon facts, ability mechanics, relationships, timeline events, or chapter outcomes from visual-only references.",
    },
    longline_excerpt_or_reference: {
      text: "長線與章節結果只依文字正史，不依上傳圖推斷。",
    },
    retrieval_context: {
      phase: "39J",
      visual_uploaded_references,
    },
    generation_context: {
      phase: "39J",
      visual_uploaded_references,
    },
  };
}

const result = await buildChatgptNativeNeuralWritingHandoff({
  task_prompt: taskPrompt,
  generation_context: {
    phase: "39J",
    route_expectation: "visual_reference_consumer_contract_hardening",
  },
  retrieval_context: {
    acceptance_smoke: "phase39j",
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
assert.equal(handoff.constraints.canon_update_allowed, false);
assert.equal(handoff.constraints.active_engine_update_allowed, false);

assert.equal(result.safety_flags.visual_reference_consumer_contract_hardened, true);
assert.equal(result.safety_flags.visual_reference_canon_inference_allowed, false);
assert.equal(result.safety_flags.visual_reference_active_engine_update_allowed, false);
assert.equal(result.safety_flags.visual_reference_canon_db_update_allowed, false);

const consumerContract = handoff.chatgpt_native_consumer_contract;
assert.equal(consumerContract.used, true);
assert.equal(consumerContract.response_owner, "ChatGPT");
assert.equal(consumerContract.must_emit_story_text_directly, true);
assert.equal(consumerContract.must_not_emit_handoff_summary, true);
assert.equal(consumerContract.must_not_emit_engineering_explanation, true);
assert.equal(consumerContract.must_not_request_backend_provider, true);
assert.equal(consumerContract.must_not_save_candidate, true);
assert.equal(consumerContract.must_not_update_canon, true);
assert.equal(consumerContract.must_not_update_active_engine, true);
assert.equal(consumerContract.must_not_enter_adoption_or_settlement, true);

assert.equal(consumerContract.visual_reference_consumer_contract_hardened, true);

const visualConsumerContract = consumerContract.visual_reference_consumer_contract;
assert.equal(visualConsumerContract.enabled, true);
assert.equal(visualConsumerContract.phase, "39J");
assert.equal(visualConsumerContract.source_scope, "visual_uploaded_references");
assert.equal(visualConsumerContract.visual_usage_scope, "visual_only_reference");
assert.equal(visualConsumerContract.canon_inference_allowed, false);
assert.equal(visualConsumerContract.ability_inference_allowed, false);
assert.equal(visualConsumerContract.soul_weapon_inference_allowed, false);
assert.equal(visualConsumerContract.relationship_inference_allowed, false);
assert.equal(visualConsumerContract.rank_inference_allowed, false);
assert.equal(visualConsumerContract.faction_inference_allowed, false);
assert.equal(visualConsumerContract.timeline_event_inference_allowed, false);
assert.equal(visualConsumerContract.chapter_outcome_inference_allowed, false);
assert.equal(visualConsumerContract.canon_db_update_allowed, false);
assert.equal(visualConsumerContract.active_engine_update_allowed, false);
assert.equal(visualConsumerContract.must_prefer_text_canon_over_visual_reference, true);
assert.equal(visualConsumerContract.must_not_establish_canon_from_visual_reference, true);
assert.equal(visualConsumerContract.must_not_update_active_engine_from_visual_reference, true);
assert.equal(visualConsumerContract.must_not_update_canon_db_from_visual_reference, true);

for (const allowed of [
  "appearance guidance",
  "pose guidance",
  "outfit/design guidance",
  "style guidance",
  "atmosphere guidance",
]) {
  assert(
    visualConsumerContract.allowed_usage.includes(allowed),
    "visual consumer contract missing allowed usage: " + allowed,
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
]) {
  assert(
    visualConsumerContract.forbidden_inference.includes(forbidden),
    "visual consumer contract missing forbidden inference: " + forbidden,
  );
}

const forbiddenMistakes = handoff.forbidden_mistakes.join("\n");
assert.match(
  forbiddenMistakes,
  /Consumer contract must preserve visual-only reference boundaries\./u,
);
assert.match(
  forbiddenMistakes,
  /Do not infer canon abilities, Soul-Weapons, relationships, ranks, factions, timeline events, or chapter outcomes from visual-only references\./u,
);

const serializedHandoff = JSON.stringify(handoff);
assert(serializedHandoff.includes("visual_reference_consumer_contract_hardened"));
assert(serializedHandoff.includes("visual_reference_consumer_contract"));
assert(serializedHandoff.includes("visual_only_reference"));
assert(serializedHandoff.includes("canon_inference_allowed"));
assert(serializedHandoff.includes("ability_inference_allowed"));
assert(serializedHandoff.includes("soul_weapon_inference_allowed"));
assert(serializedHandoff.includes("relationship_inference_allowed"));
assert(serializedHandoff.includes("timeline_event_inference_allowed"));
assert(serializedHandoff.includes("chapter_outcome_inference_allowed"));
assert(serializedHandoff.includes("must_not_update_active_engine_from_visual_reference"));
assert(serializedHandoff.includes("must_not_update_canon_db_from_visual_reference"));
assert(serializedHandoff.includes("御先反轉型態"));
assert(serializedHandoff.includes("貓狼"));

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
assert.match(serviceSource, /visual_reference_consumer_contract_hardened/u);
assert.match(serviceSource, /visual_reference_consumer_contract/u);
assert.match(serviceSource, /canon_inference_allowed/u);
assert.match(serviceSource, /ability_inference_allowed/u);
assert.match(serviceSource, /soul_weapon_inference_allowed/u);
assert.match(serviceSource, /relationship_inference_allowed/u);
assert.match(serviceSource, /timeline_event_inference_allowed/u);
assert.match(serviceSource, /chapter_outcome_inference_allowed/u);
assert.match(serviceSource, /Consumer contract must preserve visual-only reference boundaries/u);

console.log("Phase39J visual reference consumer contract hardening tests passed.");