import { createHash } from "node:crypto";
import { buildGptWritingContext } from "./gpt-writing-context-service.mjs";
import {
  executeChatgptNativeTraceOnlyNeuralModules,
} from "./chatgpt-native-trace-only-neural-execution-service.mjs";

const HANDOFF_TOOL_NAME = "chatgpt_bridge_build_full_neural_writing_handoff";
const HANDOFF_SURFACE_KIND = "chatgpt_native_full_neural_writing_handoff";
const DEFAULT_MAX_CONTEXT_CHARS = 48000;

function text(value) {
  if (typeof value === "string") return value.trim();
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function sha256(value) {
  return createHash("sha256").update(String(value ?? "")).digest("hex");
}

function toPlainJson(value, maxChars = 16000) {
  try {
    const raw = JSON.stringify(value ?? null, null, 2);
    if (raw.length <= maxChars) return raw;
    return raw.slice(0, maxChars) + "\n...[truncated:" + (raw.length - maxChars) + "]";
  } catch {
    return String(value ?? "");
  }
}

function compactObject(value, maxChars = 24000) {
  const raw = toPlainJson(value, maxChars);
  if (raw.includes("...[truncated:")) return { excerpt: raw };
  try {
    return JSON.parse(raw);
  } catch {
    return { excerpt: raw };
  }
}

function getNestedText(value) {
  if (typeof value === "string") return value.trim();
  if (!value || typeof value !== "object") return "";
  for (const key of ["text", "content", "excerpt", "body", "value"]) {
    if (typeof value[key] === "string" && value[key].trim()) return value[key].trim();
  }
  return "";
}

function findByKey(root, targetKey, seen = new Set()) {
  if (!root || typeof root !== "object") return null;
  if (seen.has(root)) return null;
  seen.add(root);

  if (Object.prototype.hasOwnProperty.call(root, targetKey)) {
    return root[targetKey];
  }

  for (const value of Object.values(root)) {
    if (value && typeof value === "object") {
      const found = findByKey(value, targetKey, seen);
      if (found !== null && found !== undefined) return found;
    }
  }

  return null;
}

function sectionText(bundle, key, maxChars = 6000) {
  const found = findByKey(bundle, key);
  const rendered = getNestedText(found) || toPlainJson(found, maxChars);
  if (!rendered) return "";
  return rendered.length <= maxChars
    ? rendered
    : rendered.slice(0, maxChars) + "\n...[truncated:" + (rendered.length - maxChars) + "]";
}

function arrayOfStrings(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => text(item)).filter(Boolean);
}

function neuralDiagnostics(bundle) {
  const requiredModules = arrayOfStrings(bundle?.required_neural_modules);
  const engineModules = Array.isArray(bundle?.engine_components_status?.components?.neural_pipeline?.modules)
    ? bundle.engine_components_status.components.neural_pipeline.modules
    : [];
  const availableModuleNames = new Set(
    engineModules
      .filter((module) => module && typeof module === "object")
      .filter((module) => module.required_status === "available" || module.status === "available")
      .map((module) => text(module.name))
      .filter(Boolean),
  );

  const missingRequiredModules = requiredModules.filter((name) => (
    availableModuleNames.size > 0 ? !availableModuleNames.has(name) : false
  ));

  const warnings = [];
  if (bundle?.engine_components_valid === false) warnings.push("engine_components_invalid");
  if (Array.isArray(bundle?.engine_component_validation_errors)) {
    for (const error of bundle.engine_component_validation_errors) {
      if (text(error)) warnings.push("engine_component_validation:" + text(error));
    }
  }
  if (Array.isArray(bundle?.warnings)) {
    for (const warning of bundle.warnings) {
      if (text(warning)) warnings.push(text(warning));
    }
  }

  return {
    required_modules_checked: true,
    neural_pipeline_required: bundle?.neural_pipeline_required === true,
    required_neural_modules: requiredModules,
    available_required_modules: [...availableModuleNames],
    missing_required_modules: missingRequiredModules,
    contract_valid: missingRequiredModules.length === 0,
    warnings,
  };
}

function normalizeInput(rawInput = {}) {
  const taskPrompt = text(rawInput.task_prompt ?? rawInput.taskPrompt);
  if (!taskPrompt) {
    throw new Error("task_prompt is required for ChatGPT native neural writing handoff.");
  }

  return {
    taskPrompt,
    generationContext: rawInput.generation_context ?? rawInput.generationContext ?? {},
    retrievalContext: rawInput.retrieval_context ?? rawInput.retrievalContext ?? {},
    chapterMode: text(rawInput.chapter_mode ?? rawInput.chapterMode ?? "continue"),
    maxContextChars: Number.isFinite(Number(rawInput.max_context_chars ?? rawInput.maxContextChars))
      ? Number(rawInput.max_context_chars ?? rawInput.maxContextChars)
      : DEFAULT_MAX_CONTEXT_CHARS,
    enableCharacterVoiceGuard:
      rawInput.enable_character_voice_guard ?? rawInput.enableCharacterVoiceGuard ?? true,
    requestedOutputMode: text(rawInput.output_mode ?? rawInput.outputMode ?? "chatgpt_native_handoff"),
  };
}

function buildFinalChatgptWritingInstruction(input) {
  return [
    "你現在是 ChatGPT 原生正文生成器；Writer Workbench 只提供神經寫作上下文與防錯 handoff，不代替你生成正文。",
    "",
    "請閱讀 chatgpt_native_writing_handoff 內的 writing_context、neural_module_execution_results、neural_trace_summary、constraints、forbidden_mistakes、neural_modules_diagnostics 後，直接依使用者任務輸出正文。",
    "",
    "使用者任務：" + input.taskPrompt,
    "",
    "硬性限制：",
    "- 不要要求使用者啟動 local generation provider、LM Studio、Ollama 或任何 backend provider。",
    "- 不要保存 candidate。",
    "- 不要寫入 Canon。",
    "- 不要更新 active_engine。",
    "- 不要進入 adoption 或 settlement 流程。",
    "- 不要把本 handoff 本身當成正文。",
    "- 若使用者要求「只輸出正文」或「從章名開始」，tool 後的 ChatGPT 回覆應直接輸出正文，不加工程說明。",
    "",
    "Visual-only reference usage hardening:",
    "- 若 writing_context.retrieval_context 或 generation_context 含 visual_uploaded_references，僅可作外觀、姿態、服裝／造型、畫面氣質與氛圍參考。",
    "- 不得從上傳圖推斷、建立或確認正史能力、能力機制、能力限制、異能武裝、角色關係、階級、陣營、時間線或章節事件。",
    "- 不得把 visual-only reference 寫成 Canon facts，也不得用它改寫 Canon DB 或 active_engine。",
    "- 若圖片資訊與 active_engine、Canon DB、主核對表或文字設定衝突，必須以文字正史資料為準；圖片僅保留為視覺參考。",
    "",
    "handoff_mode: " + input.requestedOutputMode,
  ].join("\n");
}


function buildChatgptNativeConsumerContract(input) {
  const mustStartFromTitle = /只輸出正文|從章名開始|正文/u.test(input.taskPrompt);

  return {
    used: true,
    phase: "38J",
    surface_kind: "chatgpt_native_handoff_instruction_consumer_contract",
    response_owner: "ChatGPT",
    required_response_kind: "story_text_only",
    story_text_source: "chatgpt_native_generation_after_handoff",
    must_emit_story_text_directly: true,
    must_start_from_title_when_requested: mustStartFromTitle,
    must_not_emit_handoff_summary: true,
    must_not_emit_engineering_explanation: true,
    must_not_emit_json_or_codeblock: true,
    must_not_request_backend_provider: true,
    must_not_request_local_provider: true,
    must_not_request_lm_studio_or_ollama: true,
    must_not_save_candidate: true,
    must_not_update_canon: true,
    must_not_update_active_engine: true,
    must_not_enter_adoption_or_settlement: true,
    forbidden_output_markers: [
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
    ],
    allowed_output_surface: {
      plain_text: true,
      story_prose: true,
      chapter_title_allowed: true,
      markdown_codeblock: false,
      json: false,
      diagnostics: false,
      handoff_echo: false,
      backend_generation_provider_output: false,
    },
    visual_reference_consumer_contract_hardened: true,
    visual_reference_consumer_contract: {
      enabled: true,
      phase: "39J",
      source_scope: "visual_uploaded_references",
      visual_usage_scope: "visual_only_reference",
      allowed_usage: [
        "appearance guidance",
        "pose guidance",
        "outfit/design guidance",
        "style guidance",
        "atmosphere guidance",
      ],
      forbidden_inference: [
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
      ],
      canon_inference_allowed: false,
      ability_inference_allowed: false,
      soul_weapon_inference_allowed: false,
      relationship_inference_allowed: false,
      rank_inference_allowed: false,
      faction_inference_allowed: false,
      timeline_event_inference_allowed: false,
      chapter_outcome_inference_allowed: false,
      canon_db_update_allowed: false,
      active_engine_update_allowed: false,
      must_prefer_text_canon_over_visual_reference: true,
      must_not_establish_canon_from_visual_reference: true,
      must_not_update_active_engine_from_visual_reference: true,
      must_not_update_canon_db_from_visual_reference: true,
    },
  };
}
export async function buildChatgptNativeNeuralWritingHandoff(rawInput = {}, options = {}) {
  const input = normalizeInput(rawInput);
  const buildContext = options.buildGptWritingContextFn ?? buildGptWritingContext;

  const contextResult = await buildContext({
    task_prompt: input.taskPrompt,
    generation_context: input.generationContext,
    retrieval_context: input.retrievalContext,
    chapter_mode: input.chapterMode,
    output_mode: "chat_only",
    max_context_chars: input.maxContextChars,
    include_active_engine: true,
    include_writing_card: true,
    include_proofing_card: true,
    include_longline: true,
  }, options);

  const bundle = contextResult?.bundle
    ?? contextResult?.context
    ?? contextResult?.gpt_writing_context
    ?? contextResult;

  let diagnostics = neuralDiagnostics(bundle);

  const writingContext = {
    gpt_writing_context_bundle_id: bundle?.bundle_id ?? contextResult?.bundle_id ?? null,
    task_prompt: bundle?.task_prompt ?? input.taskPrompt,
    context_builder_output_mode: bundle?.output_mode ?? "chat_only",
    active_engine_summary: sectionText(bundle, "active_engine_excerpt_or_reference"),
    writing_card_summary: sectionText(bundle, "writing_card_excerpt_or_reference"),
    proofing_card_summary: sectionText(bundle, "proofing_card_excerpt_or_reference"),
    longline_summary: sectionText(bundle, "longline_excerpt_or_reference"),
    character_voice_guard_context: sectionText(bundle, "character_voice_registry_content"),
    retrieval_context: sectionText(bundle, "retrieval_context"),
    generation_context: sectionText(bundle, "generation_context"),
    aesthetic_memory_context: sectionText(bundle, "aesthetic_memory_context"),
    character_state_context: sectionText(bundle, "character_state_context"),
    foreshadowing_context: sectionText(bundle, "foreshadowing_context"),
    reader_simulator_context: sectionText(bundle, "reader_simulator_context"),
    compact_bundle_excerpt: compactObject(bundle, 24000),
  };

  const neuralExecution = await executeChatgptNativeTraceOnlyNeuralModules({
    task_prompt: input.taskPrompt,
    generation_context: input.generationContext,
    retrieval_context: input.retrievalContext,
    chapter_mode: input.chapterMode,
    bundle,
    writing_context: writingContext,
    required_modules: diagnostics.required_neural_modules,
    include_writing_card_director: true,
    include_final_polisher: true,
  }, options);

  diagnostics = {
    ...diagnostics,
    required_modules_executed: neuralExecution.required_modules_executed,
    chatgpt_native_neural_modules_executed:
      neuralExecution.chatgpt_native_neural_modules_executed,
    module_results_attached_to_handoff:
      neuralExecution.module_results_attached_to_handoff,
    neural_trace_created: neuralExecution.neural_trace_created,
    neural_trace_run_id: neuralExecution.run_id,
    neural_execution_status: neuralExecution.status,
  };

  const constraints = {
    tool_must_not_generate_story_text: true,
    chatgpt_must_generate_after_handoff: true,
    chatgpt_may_generate_story_text: true,
    save_candidate: false,
    candidate_created: false,
    canon_update_allowed: false,
    active_engine_update_allowed: false,
    adopted: false,
    settled: false,
    backend_provider_required: false,
    local_provider_required: false,
    provider_type_required: false,
    visual_reference_final_instruction_hardened: true,

    visual_reference_consumer_contract_hardened: true,
    visual_reference_canon_inference_allowed: false,
    visual_reference_active_engine_update_allowed: false,
    visual_reference_canon_db_update_allowed: false,
  };

  const handoff = {
    used: true,
    contract_valid: true,
    surface_kind: HANDOFF_SURFACE_KIND,
    final_chatgpt_writing_instruction: buildFinalChatgptWritingInstruction(input),
    chatgpt_native_consumer_contract: buildChatgptNativeConsumerContract(input),
    writing_context: writingContext,
    neural_modules_diagnostics: diagnostics,
    neural_module_execution_results:
      neuralExecution.neural_module_execution_results,
    neural_trace_summary:
      neuralExecution.neural_trace_summary,
    chatgpt_native_neural_modules_executed:
      neuralExecution.chatgpt_native_neural_modules_executed,
    module_results_attached_to_handoff:
      neuralExecution.module_results_attached_to_handoff,
    neural_trace_created:
      neuralExecution.neural_trace_created,
    character_voice_guard_constraints: {
      enabled: input.enableCharacterVoiceGuard === true,
      must_respect_character_voice_registry: true,
      must_not_flatten_characters_into_operator_voice: true,
    },
    visual_reference_final_writing_instruction_guard: {
      enabled: true,
      phase: "39I",
      source_scope: "visual_uploaded_references",
      visual_usage_scope: "visual_only_reference",
      allowed_usage: [
        "appearance guidance",
        "pose guidance",
        "outfit/design guidance",
        "style guidance",
        "atmosphere guidance",
      ],
      forbidden_inference: [
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
      ],
      must_prefer_text_canon_over_visual_reference: true,
      must_not_establish_canon_from_visual_reference: true,
      must_not_update_active_engine_from_visual_reference: true,
      must_not_update_canon_db_from_visual_reference: true,
    },
    constraints,
    forbidden_mistakes: [
      "Do not call or require backend generation provider.",
      "Do not require local generation provider, LM Studio, or Ollama.",
      "Do not save candidate.",
      "Do not update Canon.",
      "Do not update active_engine.",
      "Do not mark adopted or settled.",
      "Do not treat this handoff as final story text.",
      "ChatGPT must generate the prose after reading this handoff.",
      "Do not infer canon abilities, Soul-Weapons, relationships, ranks, factions, timeline events, or chapter outcomes from visual-only references.",
      "Use uploaded visual references only for appearance, pose, style, outfit/design, and atmosphere guidance.",
      "Text canon, Canon DB, and active_engine override visual-only references.",
      "Consumer contract must preserve visual-only reference boundaries.",
    ],
    handoff_hash_sha256: sha256(JSON.stringify({
      task_prompt: input.taskPrompt,
      bundle_id: writingContext.gpt_writing_context_bundle_id,
      constraints,
      diagnostics,
    })),
  };

  return {
    tool_name: HANDOFF_TOOL_NAME,
    status: "ready_for_chatgpt_native_generation",
    output_mode: "chatgpt_native_handoff",
    created_at: new Date().toISOString(),
    chatgpt_native_writing_handoff: handoff,
    safety_flags: constraints,
    candidate_created: false,
    candidate_id: null,
    canon_updated: false,
    active_engine_updated: false,
    adopted: false,
    settled: false,
  };
}

export default buildChatgptNativeNeuralWritingHandoff;
