import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildChatgptNativeNeuralWritingHandoff } from "../../server/src/chatgpt-native-neural-writing-handoff-service.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";

const taskPrompt = "依最新主核對表正式續寫下一章。只輸出正文，從章名開始。";
const fixtureContexts = path.join(
  projectPaths.gptWritingContexts,
  ".phase39h-visual-reference-native-handoff-live-smoke",
);
const fixtureActive = path.join(
  projectPaths.canonDb,
  ".phase39h-visual-reference-native-handoff-active.md",
);

const expectedNeuralModules = [
  "run_scene_planner",
  "run_character_simulator",
  "run_neural_critic",
  "run_style_drift_detector",
  "run_over_governance_detector",
  "run_writing_card_director",
];

const fixtureVisualRecords = [
  {
    visual_id: "VIS-PHASE39H-MISAKI-REVERSAL",
    character: "御先反轉型態",
    title: "御先反轉型態 user uploaded visual reference",
    category: "character_design",
    source: "user_imported",
    path: "data/visual_db/assets/phase39h/misaki-reversal.png",
    canon_status: "reference",
    ability_state: "visual_only",
    status: "active",
    description:
      "御先反轉型態的使用者上傳視覺參考圖。僅作外觀、造型、姿態與氛圍參考，不建立能力、身分、關係、階級或時間線正史。",
    tags: [
      "御先反轉型態",
      "character-design",
      "user-uploaded-reference",
      "visual-only",
      "reference-only",
    ],
    metadata_source: "manual_mapping",
    metadata_enriched_at: "2026-07-06T00:00:00.000Z",
    visual_usage_scope: "visual_only_reference",
  },
  {
    visual_id: "VIS-PHASE39H-CATWOLF",
    character: "貓狼",
    title: "貓狼 user uploaded visual reference",
    category: "character_design",
    source: "user_imported",
    path: "data/visual_db/assets/phase39h/catwolf.png",
    canon_status: "reference",
    ability_state: "visual_only",
    status: "active",
    description:
      "貓狼的使用者上傳視覺參考圖。僅作外觀、造型、姿態與氛圍參考，不建立能力、身分、關係、階級或時間線正史。",
    tags: [
      "貓狼",
      "character-design",
      "user-uploaded-reference",
      "visual-only",
      "reference-only",
    ],
    metadata_source: "manual_mapping",
    metadata_enriched_at: "2026-07-06T00:00:00.000Z",
    visual_usage_scope: "visual_only_reference",
  },
];

function sha256(value) {
  return createHash("sha256").update(String(value ?? "")).digest("hex");
}

async function fileHash(filePath) {
  try {
    return sha256(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function names(directory) {
  try {
    return new Set(await readdir(directory));
  } catch (error) {
    if (error.code === "ENOENT") return new Set();
    throw error;
  }
}

async function removeNew(directory, before) {
  for (const name of await names(directory)) {
    if (!before.has(name)) {
      await rm(path.join(directory, name), { recursive: true, force: true });
    }
  }
}

function visualIndexText(records) {
  return `${records.map((record) => JSON.stringify(record)).join("\n")}\n`;
}

function fakeEngineComponentsStatus() {
  return {
    ok: true,
    read_only: true,
    engine_id: "phase39h-fixture-engine",
    design_principle: "engine-first",
    components: {
      canon_data: {
        path: "data/canon_db/active_engine.md",
        expected_sha256_lf: "fixture",
        actual_sha256_lf: "fixture",
        hash_matches: true,
      },
      writing_method: { version: "v3.0" },
      proofing_method: { version: "v1.1" },
      neural_pipeline: {
        required: true,
        modules: expectedNeuralModules.map((name) => ({
          name,
          required_status: "available",
        })),
      },
      governance_policy: { required: true, exists: true },
    },
    issues: [],
  };
}

function parseContextJson(value, label) {
  assert.equal(typeof value, "string", `${label} should be serialized JSON text.`);
  return JSON.parse(value);
}

function assertVisualReferencePacket(visualReferences) {
  assert.equal(visualReferences.loaded, true);
  assert.equal(visualReferences.reference_count, 2);
  assert.equal(visualReferences.injection_scope, "writing_context_visual_only");
  assert.equal(visualReferences.canon_status, "reference_only");
  assert.equal(visualReferences.safety_contract.visual_only, true);
  assert.equal(visualReferences.safety_contract.must_not_establish_canon, true);
  assert.equal(visualReferences.safety_contract.must_not_infer_abilities, true);
  assert.equal(visualReferences.safety_contract.must_not_infer_relationships, true);
  assert.equal(visualReferences.safety_contract.must_not_update_active_engine, true);
  assert.equal(visualReferences.safety_contract.must_not_update_canon_db, true);

  const visualItems = visualReferences.items;
  assert.equal(visualItems.length, 2);
  assert.deepEqual(
    visualItems.map((item) => item.character).sort(),
    ["御先反轉型態", "貓狼"].sort(),
  );

  for (const item of visualItems) {
    assert.equal(item.inclusion_allowed, true);
    assert.equal(item.canon_status, "reference");
    assert.equal(item.ability_state, "visual_only");
    assert.equal(item.visual_usage_scope, "visual_only_reference");
    assert(item.description.includes("僅作外觀"));
    assert(item.tags.includes("visual-only"));
    assert(item.tags.includes("reference-only"));
    assert(item.allowed_usage.includes("appearance guidance"));
    assert(item.allowed_usage.includes("pose guidance"));
    assert(item.allowed_usage.includes("style guidance"));
    assert(item.allowed_usage.includes("atmosphere guidance"));
    assert(item.forbidden_usage.includes("canon facts"));
    assert(item.forbidden_usage.includes("ability mechanics"));
    assert(item.forbidden_usage.includes("relationships"));
    assert(item.forbidden_usage.includes("timeline events"));
    assert(item.forbidden_usage.includes("chapter outcomes"));
  }
}

const productionActiveEngineHashBefore = await fileHash(projectPaths.activeEngine);
const productionVisualIndexHashBefore = await fileHash(projectPaths.visualIndex);
const transactionsBefore = await names(path.join(projectPaths.outputLogs, "transactions"));
const agentRunsBefore = await names(projectPaths.agentRuns);
const neuralTracesBefore = await names(projectPaths.neuralTraces);
const neuralOutputsBefore = await names(projectPaths.neuralModuleOutputs);

await rm(fixtureContexts, { recursive: true, force: true });
await rm(fixtureActive, { force: true });
await mkdir(path.dirname(fixtureActive), { recursive: true });
await writeFile(
  fixtureActive,
  "# Phase39H fixture active engine\n\nCanon remains unchanged during visual handoff smoke.\n",
  "utf8",
);

try {
  const result = await buildChatgptNativeNeuralWritingHandoff({
    task_prompt: taskPrompt,
    generation_context: {
      phase: "39H",
      route_expectation: "chatgpt_native_handoff_with_visual_references",
    },
    retrieval_context: {
      acceptance_smoke: "phase39h",
    },
    chapter_mode: "next_chapter",
    output_mode: "chatgpt_native_handoff",
    max_context_chars: 64000,
  }, {
    gptWritingContexts: fixtureContexts,
    activeEnginePath: fixtureActive,
    engineComponentsStatusProvider: async () => fakeEngineComponentsStatus(),
    visualUploadedReferencesOptions: {
      records: fixtureVisualRecords,
      visualIndexText: visualIndexText(fixtureVisualRecords),
    },
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

  const writingContext = handoff.writing_context;
  assert.equal(typeof writingContext, "object");
  assert.match(writingContext.task_prompt, /只輸出正文/u);
  assert.match(writingContext.active_engine_summary, /Phase39H fixture active engine/u);
  assert.match(writingContext.retrieval_context, /visual_uploaded_references/u);
  assert.match(writingContext.generation_context, /visual_uploaded_references/u);

  const parsedRetrievalContext = parseContextJson(
    writingContext.retrieval_context,
    "retrieval_context",
  );
  const parsedGenerationContext = parseContextJson(
    writingContext.generation_context,
    "generation_context",
  );

  assertVisualReferencePacket(parsedRetrievalContext.visual_uploaded_references);
  assertVisualReferencePacket(parsedGenerationContext.visual_uploaded_references);

  const compactBundle = writingContext.compact_bundle_excerpt;
  if (compactBundle && typeof compactBundle === "object" && !Object.hasOwn(compactBundle, "excerpt")) {
    assert.equal(compactBundle.visual_uploaded_references_loaded, true);
    assert.equal(compactBundle.visual_uploaded_references_count, 2);
    assert.equal(compactBundle.visual_uploaded_references.reference_count, 2);
  }

  const consumerContract = handoff.chatgpt_native_consumer_contract;
  assert.equal(consumerContract.must_emit_story_text_directly, true);
  assert.equal(consumerContract.must_not_emit_engineering_explanation, true);
  assert.equal(consumerContract.must_not_request_backend_provider, true);
  assert.equal(consumerContract.must_not_request_local_provider, true);
  assert.equal(consumerContract.must_not_save_candidate, true);
  assert.equal(consumerContract.must_not_update_canon, true);
  assert.equal(consumerContract.must_not_update_active_engine, true);
  assert.equal(consumerContract.must_not_enter_adoption_or_settlement, true);

  assert.equal(handoff.constraints.tool_must_not_generate_story_text, true);
  assert.equal(handoff.constraints.chatgpt_must_generate_after_handoff, true);
  assert.equal(handoff.constraints.chatgpt_may_generate_story_text, true);
  assert.equal(handoff.constraints.save_candidate, false);
  assert.equal(handoff.constraints.candidate_created, false);
  assert.equal(handoff.constraints.canon_update_allowed, false);
  assert.equal(handoff.constraints.active_engine_update_allowed, false);
  assert.equal(handoff.constraints.backend_provider_required, false);
  assert.equal(handoff.constraints.local_provider_required, false);
  assert.equal(handoff.constraints.provider_type_required, false);

  const serializedHandoff = JSON.stringify(handoff);
  assert(serializedHandoff.includes("御先反轉型態"));
  assert(serializedHandoff.includes("貓狼"));
  assert(serializedHandoff.includes("visual_only_reference"));
  assert(serializedHandoff.includes("appearance guidance"));
  assert(serializedHandoff.includes("ability mechanics"));
  assert(serializedHandoff.includes("timeline events"));

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

  assert.equal(await fileHash(projectPaths.activeEngine), productionActiveEngineHashBefore);
  assert.equal(await fileHash(projectPaths.visualIndex), productionVisualIndexHashBefore);

  console.log("Phase39H visual reference native handoff live smoke tests passed.");
} finally {
  await rm(fixtureContexts, { recursive: true, force: true });
  await rm(fixtureActive, { force: true });
  await removeNew(path.join(projectPaths.outputLogs, "transactions"), transactionsBefore);
  await removeNew(projectPaths.neuralModuleOutputs, neuralOutputsBefore);
  await removeNew(projectPaths.neuralTraces, neuralTracesBefore);
  await removeNew(projectPaths.agentRuns, agentRunsBefore);
}
