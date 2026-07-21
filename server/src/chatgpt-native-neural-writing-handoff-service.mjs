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
export function classifyChatgptNativeConsumerOutputAgainstVisualReferenceContract(outputText, consumerContract = {}) {
  const output = text(outputText);
  const visualContract = consumerContract?.visual_reference_consumer_contract ?? {};
  const contractEnabled = consumerContract?.visual_reference_consumer_contract_hardened === true
    || visualContract?.enabled === true;
  const errors = [];

  const misusePatterns = [
    {
      code: "visual_reference_canon_or_story_inference",
      pattern: /(?:因為|根據|依據|從)?(?:上傳圖|參考圖|圖片).*?(?:確認|推斷|建立|判定|證明).*?(?:正史|Canon|能力|異能武裝|Soul-Weapon|武裝|關係|階級|陣營|時間線|章節事件|章節結果|chapter outcome)/iu,
    },
    {
      code: "visual_reference_english_canon_or_story_inference",
      pattern: /visual-only reference.*?(?:confirms|establishes|infers|creates|proves).*?(?:canon|ability|soul[- ]?weapon|relationship|rank|faction|timeline|chapter outcome)/iu,
    },
    {
      code: "visual_reference_canon_db_or_active_engine_update",
      pattern: /(?:(?:上傳圖|參考圖|圖片).*?(?:改寫|更新).*?(?:Canon DB|Canon|active_engine)|(?:改寫|更新).*?(?:Canon DB|Canon|active_engine).*?(?:上傳圖|參考圖|圖片))/iu,
    },
    {
      code: "visual_reference_english_canon_db_or_active_engine_update",
      pattern: /visual-only reference.*?(?:updates|rewrites).*?(?:Canon DB|Canon|active_engine)/iu,
    },
  ];

  if (contractEnabled) {
    for (const item of misusePatterns) {
      if (item.pattern.test(output)) {
        errors.push({
          code: "visual_reference_consumer_output_misuse",
          detail: item.code,
        });
      }
    }
  }

  return {
    checked: true,
    contract_enabled: contractEnabled,
    accepted: errors.length === 0,
    errors,
    visual_usage_scope: visualContract?.visual_usage_scope ?? null,
    canon_inference_allowed: visualContract?.canon_inference_allowed === true,
    ability_inference_allowed: visualContract?.ability_inference_allowed === true,
    soul_weapon_inference_allowed: visualContract?.soul_weapon_inference_allowed === true,
    relationship_inference_allowed: visualContract?.relationship_inference_allowed === true,
    timeline_event_inference_allowed: visualContract?.timeline_event_inference_allowed === true,
    chapter_outcome_inference_allowed: visualContract?.chapter_outcome_inference_allowed === true,
    canon_db_update_allowed: visualContract?.canon_db_update_allowed === true,
    active_engine_update_allowed: visualContract?.active_engine_update_allowed === true,
  };
}
export function buildChatgptNativeConsumerOutputVisualReferenceGuardReport(outputText, consumerContract = {}, options = {}) {
  const output = text(outputText);
  const maxExcerptChars = Number.isFinite(Number(options.max_excerpt_chars ?? options.maxExcerptChars))
    ? Math.max(0, Number(options.max_excerpt_chars ?? options.maxExcerptChars))
    : 600;
  const classification = classifyChatgptNativeConsumerOutputAgainstVisualReferenceContract(
    output,
    consumerContract,
  );
  const errors = Array.isArray(classification.errors) ? classification.errors : [];
  const misuseDetails = [...new Set(errors.map((error) => text(error?.detail)).filter(Boolean))];

  return {
    used: true,
    phase: "39L",
    surface_kind: "chatgpt_native_consumer_output_visual_reference_guard_report",
    report_kind: "visual_reference_consumer_output_guard_report",
    source_classifier: "classifyChatgptNativeConsumerOutputAgainstVisualReferenceContract",
    checked: classification.checked === true,
    contract_enabled: classification.contract_enabled === true,
    accepted: classification.accepted === true,
    blocked: classification.accepted !== true,
    severity: classification.accepted === true ? "pass" : "error",
    error_count: errors.length,
    errors,
    misuse_details: misuseDetails,
    visual_usage_scope: classification.visual_usage_scope ?? null,
    safety_flags: {
      visual_reference_consumer_contract_hardened:
        consumerContract?.visual_reference_consumer_contract_hardened === true,
      visual_reference_consumer_output_checked: classification.checked === true,
      visual_reference_consumer_output_accepted: classification.accepted === true,
      visual_reference_consumer_output_blocked: classification.accepted !== true,
      canon_inference_allowed: classification.canon_inference_allowed === true,
      ability_inference_allowed: classification.ability_inference_allowed === true,
      soul_weapon_inference_allowed: classification.soul_weapon_inference_allowed === true,
      relationship_inference_allowed: classification.relationship_inference_allowed === true,
      timeline_event_inference_allowed: classification.timeline_event_inference_allowed === true,
      chapter_outcome_inference_allowed: classification.chapter_outcome_inference_allowed === true,
      canon_db_update_allowed: classification.canon_db_update_allowed === true,
      active_engine_update_allowed: classification.active_engine_update_allowed === true,
    },
    allowed_final_output_use: [
      "appearance guidance",
      "pose guidance",
      "outfit/design guidance",
      "style guidance",
      "atmosphere guidance",
    ],
    forbidden_final_output_inference: [
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
    ],
    operator_summary: classification.accepted === true
      ? "Visual reference consumer output accepted: no visual-only reference misuse detected."
      : "Visual reference consumer output rejected: visual-only reference misuse detected.",
    output_excerpt: output.length <= maxExcerptChars
      ? output
      : output.slice(0, maxExcerptChars) + "\n...[truncated:" + (output.length - maxExcerptChars) + "]",
  };
}
export function buildChatgptNativeConsumerOutputVisualReferenceGuardBridgePreview(outputText, consumerContract = {}, options = {}) {
  const packetId = text(options.packet_id ?? options.packetId)
    || "visual-reference-consumer-guard-report-bridge-preview";
  const report = buildChatgptNativeConsumerOutputVisualReferenceGuardReport(
    outputText,
    consumerContract,
    options,
  );
  const blocked = report.blocked === true;

  return {
    used: true,
    phase: "39M",
    surface_kind: "chatgpt_native_consumer_output_visual_reference_guard_bridge_preview",
    preview_kind: "visual_reference_consumer_guard_report_bridge_preview",
    packet_id: packetId,
    bridge_packet_ready: true,
    report_attached: true,
    report_surface_kind: report.surface_kind,
    source_report_kind: report.report_kind,
    source_classifier: report.source_classifier,
    accepted: report.accepted === true,
    blocked,
    severity: report.severity,
    error_count: report.error_count,
    misuse_details: report.misuse_details,
    visual_usage_scope: report.visual_usage_scope,
    operator_review: {
      required: blocked,
      reason: blocked
        ? "visual_only_reference_misuse_detected"
        : "no_visual_only_reference_misuse_detected",
      misuse_details: report.misuse_details,
      summary: report.operator_summary,
    },
    ui_preview: {
      display_ready: true,
      title: "Visual Reference Consumer Output Guard",
      status: blocked ? "blocked" : "accepted",
      severity: report.severity,
      summary: report.operator_summary,
      output_excerpt: report.output_excerpt,
    },
    tool_facing_packet: {
      read_only: true,
      may_display_to_operator: true,
      may_display_in_ui: true,
      may_feed_mcp_preview: true,
      must_not_generate_story_text: true,
      must_not_save_candidate: true,
      must_not_update_canon: true,
      must_not_update_active_engine: true,
      must_not_enter_adoption_or_settlement: true,
    },
    safety_flags: {
      ...report.safety_flags,
      visual_reference_guard_bridge_preview_ready: true,
      visual_reference_guard_report_attached: true,
      candidate_created: false,
      canon_updated: false,
      active_engine_updated: false,
      adopted: false,
      settled: false,
    },
    report,
  };
}
export function buildChatgptNativeConsumerOutputVisualReferenceGuardToolExposureReadiness(outputText, consumerContract = {}, options = {}) {
  const toolName = text(options.tool_name ?? options.toolName)
    || "chatgpt_bridge_preview_visual_reference_consumer_output_guard";
  const preview = buildChatgptNativeConsumerOutputVisualReferenceGuardBridgePreview(
    outputText,
    consumerContract,
    options,
  );
  const toolPacket = preview.tool_facing_packet ?? {};
  const safetyFlags = preview.safety_flags ?? {};
  const readOnly = toolPacket.read_only === true;
  const noMutation = toolPacket.must_not_generate_story_text === true
    && toolPacket.must_not_save_candidate === true
    && toolPacket.must_not_update_canon === true
    && toolPacket.must_not_update_active_engine === true
    && toolPacket.must_not_enter_adoption_or_settlement === true
    && safetyFlags.candidate_created === false
    && safetyFlags.canon_updated === false
    && safetyFlags.active_engine_updated === false
    && safetyFlags.adopted === false
    && safetyFlags.settled === false;
  const displayReady = preview.ui_preview?.display_ready === true
    && toolPacket.may_display_to_operator === true
    && toolPacket.may_display_in_ui === true;
  const mcpPreviewReady = preview.bridge_packet_ready === true
    && preview.report_attached === true
    && toolPacket.may_feed_mcp_preview === true;
  const toolExposureReady = readOnly && noMutation && displayReady && mcpPreviewReady;

  return {
    used: true,
    phase: "39N",
    surface_kind: "chatgpt_native_consumer_output_visual_reference_guard_tool_exposure_readiness",
    readiness_kind: "visual_reference_consumer_guard_tool_exposure_readiness",
    tool_name: toolName,
    tool_profile: "readonly_preview",
    tool_exposure_ready: toolExposureReady,
    mcp_preview_ready: mcpPreviewReady,
    bridge_packet_ready: preview.bridge_packet_ready === true,
    report_attached: preview.report_attached === true,
    read_only: readOnly,
    no_mutation_guarantee: noMutation,
    operator_review_ready: preview.operator_review && typeof preview.operator_review === "object",
    ui_preview_ready: preview.ui_preview?.display_ready === true,
    accepted: preview.accepted === true,
    blocked: preview.blocked === true,
    severity: preview.severity,
    error_count: preview.error_count,
    misuse_details: preview.misuse_details,
    exposure_contract: {
      may_expose_as_readonly_tool: toolExposureReady,
      may_expose_to_mcp: mcpPreviewReady && readOnly && noMutation,
      may_display_to_operator: toolPacket.may_display_to_operator === true,
      may_display_in_ui: toolPacket.may_display_in_ui === true,
      may_feed_mcp_preview: toolPacket.may_feed_mcp_preview === true,
      must_not_generate_story_text: true,
      must_not_save_candidate: true,
      must_not_update_canon: true,
      must_not_update_active_engine: true,
      must_not_enter_adoption_or_settlement: true,
    },
    safety_flags: {
      ...safetyFlags,
      visual_reference_guard_tool_exposure_readiness_ready: toolExposureReady,
      visual_reference_guard_tool_exposure_readonly: readOnly,
      visual_reference_guard_tool_exposure_no_mutation: noMutation,
      visual_reference_guard_tool_exposure_mcp_preview_ready: mcpPreviewReady,
      visual_reference_guard_tool_exposure_ui_preview_ready: preview.ui_preview?.display_ready === true,
      candidate_created: false,
      canon_updated: false,
      active_engine_updated: false,
      adopted: false,
      settled: false,
    },
    bridge_preview: preview,
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

  const effectiveInput = {
    ...input,
    taskPrompt: bundle?.task_prompt ?? input.taskPrompt,
    generationContext:
      bundle?.inputs?.generation_context
      ?? input.generationContext,
    retrievalContext:
      bundle?.inputs?.retrieval_context
      ?? input.retrievalContext,
  };

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
    task_prompt: effectiveInput.taskPrompt,
    generation_context: effectiveInput.generationContext,
    retrieval_context: effectiveInput.retrievalContext,
    chapter_mode: effectiveInput.chapterMode,
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
    architecture_role: "gpt_external_brain",
    orchestration_mode: "writer_workbench_aggregate_compatibility",
    orchestration_owner: "writer_workbench",
    capability_consumer: "chatgpt",
    capability_provider: "writer_workbench",
    runtime_host: "writer_workbench_runtime",
    final_prose_generator: "chatgpt",
    architecture_primary_route: false,
    compatibility_aggregate_surface: true,
    surface_kind: HANDOFF_SURFACE_KIND,
    final_chatgpt_writing_instruction:
      buildFinalChatgptWritingInstruction(effectiveInput),
    chatgpt_native_consumer_contract:
      buildChatgptNativeConsumerContract(effectiveInput),
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
      task_prompt: effectiveInput.taskPrompt,
      bundle_id: writingContext.gpt_writing_context_bundle_id,
      constraints,
      diagnostics,
    })),
  };

  return {
    tool_name: HANDOFF_TOOL_NAME,
    orchestration_mode: "writer_workbench_aggregate_compatibility",
    architecture_primary_route: false,
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
