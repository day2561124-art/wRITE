import { createHash } from "node:crypto";
import { buildGptWritingContext } from "./gpt-writing-context-service.mjs";
import { runFinalPolisherEditorialBrain } from "./final-polisher-editorial-service.mjs";

const preGenerationModules = [
  "run_scene_planner",
  "run_character_simulator",
  "run_neural_critic",
  "run_style_drift_detector",
  "run_over_governance_detector",
  "run_writing_card_director",
];

const postGenerationModules = [
  "run_final_polisher",
];

const taskPromptMaxLength = 12_000;

function sha256(value) {
  return createHash("sha256").update(String(value ?? "")).digest("hex");
}

function requiredText(value, label, maxLength = taskPromptMaxLength) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  const text = value.trim();
  if (text.length > maxLength) throw new Error(`${label} exceeds ${maxLength} characters.`);
  return text;
}

function optionalText(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function optionalObject(value, label) {
  if (value === undefined || value === null) return {};
  if (typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value;
}

function optionalBoolean(value, fallback, label) {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "boolean") throw new Error(`${label} must be a boolean.`);
  return value;
}

function normalizeRequiredModules(modules) {
  return (Array.isArray(modules) ? modules : [])
    .map((moduleName) => String(moduleName ?? "").trim())
    .filter(Boolean);
}

function hasModule(requiredModules, expectedModule) {
  const normalizedExpected = String(expectedModule).replace(/^run_/u, "");
  return requiredModules.some((moduleName) => (
    moduleName === expectedModule || moduleName.replace(/^run_/u, "") === normalizedExpected
  ));
}

function summarizeRequiredModules(requiredModules) {
  return {
    required_modules: requiredModules,
    pre_generation_required_modules: preGenerationModules.filter((moduleName) => (
      hasModule(requiredModules, moduleName)
    )),
    post_generation_required_modules: postGenerationModules.filter((moduleName) => (
      hasModule(requiredModules, moduleName)
    )),
  };
}

function normalizeInput(rawInput = {}) {
  if (!rawInput || typeof rawInput !== "object" || Array.isArray(rawInput)) {
    throw new Error("input must be an object.");
  }
  return {
    taskPrompt: requiredText(rawInput.task_prompt ?? rawInput.taskPrompt, "task_prompt"),
    generationContext: optionalObject(
      rawInput.generation_context ?? rawInput.generationContext,
      "generation_context",
    ),
    retrievalContext: optionalObject(
      rawInput.retrieval_context ?? rawInput.retrievalContext,
      "retrieval_context",
    ),
    rawDraftText: optionalText(rawInput.raw_draft_text ?? rawInput.rawDraftText),
    chapterMode: String(rawInput.chapter_mode ?? rawInput.chapterMode ?? "next_chapter").trim(),
    outputMode: String(rawInput.output_mode ?? rawInput.outputMode ?? "candidate_save_later").trim(),
    runNeuralTraces: optionalBoolean(
      rawInput.run_neural_traces ?? rawInput.runNeuralTraces,
      false,
      "run_neural_traces",
    ),
    includeWritingCardDirector: optionalBoolean(
      rawInput.include_writing_card_director ?? rawInput.includeWritingCardDirector,
      true,
      "include_writing_card_director",
    ),
    structuralSignals: optionalObject(
      rawInput.structural_signals ?? rawInput.structuralSignals,
      "structural_signals",
    ),
  };
}

function pipelineStageFor({ rawDraftText, finalPolisherResult }) {
  if (!rawDraftText) return "pre_generation_ready";
  if (finalPolisherResult?.needs_structural_revision === true) return "structural_revision_required";
  if (finalPolisherResult?.status === "completed") return "final_candidate_ready";
  return "post_generation_incomplete";
}

export async function buildFullNeuralWritingOrchestration(rawInput = {}, options = {}) {
  const input = normalizeInput(rawInput);

  const contextResult = await buildGptWritingContext({
    task_prompt: input.taskPrompt,
    generation_context: input.generationContext,
    retrieval_context: input.retrievalContext,
    chapter_mode: input.chapterMode,
    output_mode: input.outputMode,
    include_writing_card_director: input.includeWritingCardDirector,
    run_neural_traces: input.runNeuralTraces,
  }, options.gptWritingContextOptions ?? options);

  const bundle = contextResult.bundle;
  const requiredModules = normalizeRequiredModules(bundle.required_neural_modules);
  const moduleSummary = summarizeRequiredModules(requiredModules);

  let finalPolisherResult = null;
  let finalCandidateText = "";
  let candidateOutputReady = false;

  if (input.rawDraftText) {
    finalPolisherResult = runFinalPolisherEditorialBrain({
      raw_draft_text: input.rawDraftText,
      writing_card_director_context: bundle.content?.writing_card_director_context ?? null,
      structural_signals: input.structuralSignals,
    });

    if (
      finalPolisherResult.status === "completed"
      && finalPolisherResult.needs_structural_revision !== true
    ) {
      finalCandidateText = finalPolisherResult.polished_text;
      candidateOutputReady = true;
    }
  }

  const pipelineStage = pipelineStageFor({
    rawDraftText: input.rawDraftText,
    finalPolisherResult,
  });

  const rawDraftHash = input.rawDraftText ? sha256(input.rawDraftText) : "";
  const finalCandidateHash = finalCandidateText ? sha256(finalCandidateText) : "";

  const orchestrationReport = {
    orchestration_version: "phase22u-lite-v1",
    pipeline_stage: pipelineStage,
    engine_first: true,
    local_generation_allowed: false,
    canon_update_allowed: false,
    active_engine_update_allowed: false,
    adoption_allowed: false,
    settlement_allowed: false,
    candidate_only: true,
    pre_generation_complete: Boolean(bundle.bundle_id),
    raw_draft_received: Boolean(input.rawDraftText),
    post_generation_complete: candidateOutputReady,
    writing_pipeline_complete: candidateOutputReady,
    raw_draft_hash: rawDraftHash,
    final_candidate_hash: finalCandidateHash,
    context_bundle_id: bundle.bundle_id,
    context_bundle_path: contextResult.context_bundle_path,
    context_for_chat_path: contextResult.context_for_chat_path,
    required_modules: moduleSummary.required_modules,
    pre_generation_required_modules: moduleSummary.pre_generation_required_modules,
    post_generation_required_modules: moduleSummary.post_generation_required_modules,
    neural_trace_complete: bundle.neural_trace_complete ?? null,
    neural_modules_used: bundle.neural_modules_used ?? [],
    warnings: [
      ...(bundle.warnings ?? []).map((warning) => `context:${warning}`),
      ...(finalPolisherResult?.warnings ?? []).map((warning) => `final_polisher:${warning}`),
    ],
  };

  return {
    ok: pipelineStage !== "post_generation_incomplete",
    pipeline_stage: pipelineStage,
    orchestration_report: orchestrationReport,
    pre_generation: {
      status: "context_ready",
      bundle_id: bundle.bundle_id,
      context_bundle_path: contextResult.context_bundle_path,
      context_for_chat_path: contextResult.context_for_chat_path,
      required_modules: moduleSummary.pre_generation_required_modules,
      writing_card_director_context_present: Boolean(bundle.content?.writing_card_director_context),
      chapter_anchor_present: Boolean(bundle.content?.chapter_anchor),
      guard_severity: bundle.guard_severity ?? null,
      neural_trace_complete: bundle.neural_trace_complete ?? null,
    },
    raw_generation: {
      status: input.rawDraftText ? "raw_draft_received" : "waiting_for_gpt_raw_draft",
      raw_draft_hash: rawDraftHash,
      raw_draft_chars: input.rawDraftText.length,
    },
    post_generation: {
      status: finalPolisherResult?.status ?? "waiting_for_raw_draft",
      required_modules: moduleSummary.post_generation_required_modules,
      final_polisher_revision_report: finalPolisherResult?.revision_report ?? null,
      needs_structural_revision: finalPolisherResult?.needs_structural_revision ?? false,
      suggested_return_stage: finalPolisherResult?.suggested_return_stage ?? null,
    },
    candidate_output: {
      ready: candidateOutputReady,
      final_candidate_text: finalCandidateText,
      final_candidate_hash: finalCandidateHash,
      save_allowed: candidateOutputReady,
      canon_status: "candidate_only",
      active_engine_update_allowed: false,
      canon_update_allowed: false,
    },
  };
}
