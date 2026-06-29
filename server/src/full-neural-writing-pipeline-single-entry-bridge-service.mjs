import { createHash } from "node:crypto";
import { buildCandidateProofingContext } from "./candidate-proofing-context-service.mjs";
import { runFullRecursiveWritingPipeline } from "./full-recursive-writing-pipeline-service.mjs";
import { buildReaderResponseSimulatorReport } from "./reader-response-simulator-service.mjs";

export const fullNeuralWritingPipelineSingleEntryBridgeVersion =
  "full_neural_writing_pipeline_single_entry_bridge_v1";

function sha256Json(value) {
  return createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex");
}

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function object(value, label) {
  if (value === undefined || value === null) return {};
  if (!isObject(value)) throw new Error(`${label} must be an object.`);
  return value;
}

function text(value, label, maximum = 12_000) {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") throw new Error(`${label} must be a string.`);
  const normalized = value.trim();
  if (normalized.length > maximum) throw new Error(`${label} exceeds ${maximum} characters.`);
  return normalized;
}

function requiredText(value, label, maximum = 12_000) {
  const normalized = text(value, label, maximum);
  if (!normalized) throw new Error(`${label} is required.`);
  return normalized;
}

function bool(raw, snake, camel, fallback) {
  const value = raw[snake] ?? raw[camel];
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "boolean") throw new Error(`${snake} must be a boolean.`);
  return value;
}

function integer(value, fallback, label, maximum = 8) {
  if (value === undefined || value === null) return fallback;
  if (!Number.isInteger(value) || value < 1 || value > maximum) {
    throw new Error(`${label} must be an integer between 1 and ${maximum}.`);
  }
  return value;
}

function arrayOfText(value, maximum = 24) {
  const raw = Array.isArray(value) ? value : [];
  return raw
    .map((item) => typeof item === "string" ? item.trim() : "")
    .filter(Boolean)
    .slice(0, maximum);
}

function normalizeInput(raw = {}) {
  if (!isObject(raw)) throw new Error("input must be an object.");

  return {
    taskPrompt: requiredText(raw.task_prompt ?? raw.taskPrompt, "task_prompt"),
    generationContext: object(raw.generation_context ?? raw.generationContext, "generation_context"),
    retrievalContext: object(raw.retrieval_context ?? raw.retrievalContext, "retrieval_context"),
    aestheticMemoryContext: object(
      raw.aesthetic_memory_context ?? raw.aestheticMemoryContext,
      "aesthetic_memory_context",
    ),
    readerResponseConflictPlan: object(
      raw.reader_response_conflict_plan ?? raw.readerResponseConflictPlan,
      "reader_response_conflict_plan",
    ),
    readerQuestionsToCarryForward: arrayOfText(
      raw.reader_questions_to_carry_forward ?? raw.readerQuestionsToCarryForward,
      20,
    ),
    characterNames: arrayOfText(
      raw.character_names ?? raw.characterNames ?? raw.characters,
      24,
    ),
    saveCandidate: bool(raw, "save_candidate", "saveCandidate", false),
    buildProofingContext: bool(raw, "build_proofing_context", "buildProofingContext", false),
    proofingMode: text(raw.proofing_mode ?? raw.proofingMode, "proofing_mode", 100) || "full",
    maxRevisionRounds: integer(
      raw.max_revision_rounds ?? raw.maxRevisionRounds,
      2,
      "max_revision_rounds",
      8,
    ),
    maxContextChars: integer(
      raw.max_context_chars ?? raw.maxContextChars,
      120_000,
      "max_context_chars",
      250_000,
    ),
    includeCharacterMindStateLedger: bool(
      raw,
      "include_character_mind_state_ledger",
      "includeCharacterMindStateLedger",
      true,
    ),
    includeDramaticConflictManager: bool(
      raw,
      "include_dramatic_conflict_manager",
      "includeDramaticConflictManager",
      true,
    ),
    includeForeshadowingCausalGraph: bool(
      raw,
      "include_foreshadowing_causal_graph",
      "includeForeshadowingCausalGraph",
      true,
    ),
    includeForeshadowingPayoffGuard: bool(
      raw,
      "include_foreshadowing_payoff_guard",
      "includeForeshadowingPayoffGuard",
      true,
    ),
    includeForeshadowingPayoffRepairPlanner: bool(
      raw,
      "include_foreshadowing_payoff_repair_planner",
      "includeForeshadowingPayoffRepairPlanner",
      true,
    ),
    includeForeshadowingPayoffAcceptanceGate: bool(
      raw,
      "include_foreshadowing_payoff_acceptance_gate",
      "includeForeshadowingPayoffAcceptanceGate",
      true,
    ),
    includeForeshadowingSettlementDiffPreview: bool(
      raw,
      "include_foreshadowing_settlement_diff_preview",
      "includeForeshadowingSettlementDiffPreview",
      false,
    ),
    includeReaderResponseSimulator: bool(
      raw,
      "include_reader_response_simulator",
      "includeReaderResponseSimulator",
      true,
    ),
    includeAestheticMemoryContext: bool(
      raw,
      "include_aesthetic_memory_context",
      "includeAestheticMemoryContext",
      true,
    ),
  };
}

function disabledProofingContext(requested, status, reason = null) {
  return {
    requested,
    built: false,
    status,
    reason,
    proofing_context_id: null,
    proofing_context_path: null,
    proofing_for_chat_path: null,
    active_engine_update_allowed: false,
    canon_update_allowed: false,
    adoption_allowed: false,
  };
}

function disabledReaderResponse(status, reason = null) {
  return {
    used: false,
    phase: "29A",
    version: "reader_response_simulator_v1",
    status,
    reason,
    read_only: true,
    candidate_only: true,
    no_auto_persist: true,
    no_generation: true,
    no_canon_update: true,
    no_active_engine_update: true,
  };
}

function nextAction(pipeline, proofingContext) {
  if (!pipeline.final_candidate_text) {
    const byStopReason = {
      generation_provider_required: "configure_backend_generation_provider",
      generation_provider_secret_missing: "configure_backend_generation_provider",
      revision_provider_required: "configure_backend_revision_provider",
      structural_revision_required: "review_revision_failure",
      max_revision_rounds_exhausted: "review_revision_failure",
    };
    return byStopReason[pipeline.stop_reason] ?? "review_pipeline_failure";
  }

  if (proofingContext.built) return "review_proofing_context";
  if (pipeline.candidate_created) return "review_saved_candidate";
  return "output_final_candidate_text_to_chat";
}

function buildAestheticMemoryContext(input) {
  const hasPayload = Object.keys(input.aestheticMemoryContext).length > 0;
  return {
    used: input.includeAestheticMemoryContext && hasPayload,
    phase: "30A-33J",
    version: "aesthetic_memory_single_entry_context_reference_v1",
    status: input.includeAestheticMemoryContext
      ? (hasPayload ? "attached_to_single_entry_payload" : "available_upstream_not_attached")
      : "disabled",
    read_only: true,
    candidate_only: true,
    no_auto_persist: true,
    no_context_build: true,
    no_context_attach_to_canon: true,
    no_canon_update: true,
    no_active_engine_update: true,
    context: hasPayload ? input.aestheticMemoryContext : null,
  };
}

function buildWorkflowSteps(pipeline, readerResponse, proofingContext, aestheticMemoryContext) {
  return [
    {
      key: "build_context",
      label: "Build writing context",
      completed: Boolean(pipeline.report?.context_hash),
      status: pipeline.report?.context_hash ? "completed" : "unavailable",
    },
    {
      key: "pre_generation_modules",
      label: "Run pre-generation modules",
      completed: true,
      modules: {
        character_mind_state_ledger: pipeline.character_mind_state_ledger?.used === true,
        dramatic_conflict_manager: pipeline.dramatic_conflict_manager?.used === true,
        foreshadowing_causal_graph: pipeline.foreshadowing_causal_graph?.used === true,
        foreshadowing_payoff_guard: pipeline.foreshadowing_payoff_guard?.used === true,
        aesthetic_memory_context: aestheticMemoryContext.used === true,
      },
    },
    {
      key: "generate_raw_draft",
      label: "Generate raw draft",
      completed: Boolean(pipeline.generation?.raw_draft_hash),
      status: pipeline.generation?.status ?? "unknown",
    },
    {
      key: "recursive_revision",
      label: "Critique and revise draft",
      completed: ["not_needed", "revised"].includes(pipeline.recursive_revision?.status),
      status: pipeline.recursive_revision?.status ?? "unknown",
      rounds_attempted: pipeline.recursive_revision?.rounds_attempted ?? 0,
    },
    {
      key: "final_polisher",
      label: "Run final polisher",
      completed: pipeline.final_polisher?.status === "completed",
      status: pipeline.final_polisher?.status ?? "unknown",
    },
    {
      key: "reader_response_simulator",
      label: "Simulate reader response",
      completed: readerResponse.used === true,
      status: readerResponse.status,
    },
    {
      key: "save_candidate",
      label: "Save candidate",
      requested: pipeline.save_candidate_requested === true,
      completed: pipeline.candidate_created === true,
    },
    {
      key: "proofing_context",
      label: "Build proofing context",
      requested: proofingContext.requested === true,
      completed: proofingContext.built === true,
      status: proofingContext.status,
    },
  ];
}

export async function runFullNeuralWritingPipelineSingleEntryBridge(rawInput = {}, options = {}) {
  const input = normalizeInput(rawInput);
  const aestheticMemoryContext = buildAestheticMemoryContext(input);

  const pipeline = await runFullRecursiveWritingPipeline({
    ...rawInput,
    task_prompt: input.taskPrompt,
    generation_context: input.generationContext,
    retrieval_context: input.retrievalContext,
    save_candidate: input.saveCandidate,
    max_revision_rounds: input.maxRevisionRounds,
    character_names: input.characterNames,
    include_character_mind_state_ledger: input.includeCharacterMindStateLedger,
    include_dramatic_conflict_manager: input.includeDramaticConflictManager,
    include_foreshadowing_causal_graph: input.includeForeshadowingCausalGraph,
    include_foreshadowing_payoff_guard: input.includeForeshadowingPayoffGuard,
    include_foreshadowing_payoff_repair_planner: input.includeForeshadowingPayoffRepairPlanner,
    include_foreshadowing_payoff_acceptance_gate: input.includeForeshadowingPayoffAcceptanceGate,
    include_foreshadowing_settlement_diff_preview: input.includeForeshadowingSettlementDiffPreview,
    output_mode: "chat_text",
  }, options);

  let readerResponse = disabledReaderResponse("skipped", "final_candidate_text_missing");
  if (input.includeReaderResponseSimulator && pipeline.final_candidate_text) {
    readerResponse = await buildReaderResponseSimulatorReport({
      task_prompt: input.taskPrompt,
      candidate_text: pipeline.final_candidate_text,
      dramatic_conflict_plan: Object.keys(input.readerResponseConflictPlan).length
        ? input.readerResponseConflictPlan
        : (pipeline.dramatic_conflict_manager?.plan ?? {}),
      reader_questions_to_carry_forward: input.readerQuestionsToCarryForward,
    });
  } else if (!input.includeReaderResponseSimulator) {
    readerResponse = disabledReaderResponse("disabled", "include_reader_response_simulator_false");
  }

  let proofingContext = disabledProofingContext(input.buildProofingContext, "disabled");
  if (input.buildProofingContext && !input.saveCandidate) {
    proofingContext = disabledProofingContext(true, "not_built", "save_candidate_required");
  } else if (input.buildProofingContext && pipeline.candidate_created && pipeline.candidate_id) {
    const proofing = await buildCandidateProofingContext({
      candidate_id: pipeline.candidate_id,
      proofing_mode: input.proofingMode,
      include_candidate_content: true,
      include_active_engine: false,
      include_writing_card: true,
      include_proofing_card: true,
      include_longline: true,
      retrieval_context: input.retrievalContext,
      generation_context: input.generationContext,
      max_context_chars: input.maxContextChars,
    }, options);

    proofingContext = {
      requested: true,
      built: true,
      status: "built",
      reason: null,
      proofing_context_id: proofing.context.proofing_context_id,
      proofing_context_path: proofing.proofing_context_path,
      proofing_for_chat_path: proofing.proofing_for_chat_path,
      active_engine_update_allowed: proofing.context.active_engine_update_allowed === true,
      canon_update_allowed: proofing.context.canon_update_allowed === true,
      adoption_allowed: proofing.context.adoption_allowed === true,
    };
  } else if (input.buildProofingContext) {
    proofingContext = disabledProofingContext(
      true,
      "not_built",
      pipeline.stop_reason ?? "candidate_not_created",
    );
  }

  const workflowSteps = buildWorkflowSteps(
    pipeline,
    readerResponse,
    proofingContext,
    aestheticMemoryContext,
  );

  const finalCandidateHash = pipeline.final_candidate_hash || (
    pipeline.final_candidate_text
      ? createHash("sha256").update(pipeline.final_candidate_text).digest("hex")
      : ""
  );

  const summary = {
    phase: "34A",
    version: fullNeuralWritingPipelineSingleEntryBridgeVersion,
    status: pipeline.status,
    pipeline_stage: pipeline.pipeline_stage,
    stop_reason: pipeline.stop_reason,
    final_candidate_hash: finalCandidateHash,
    candidate_created: pipeline.candidate_created === true,
    proofing_context_built: proofingContext.built === true,
    reader_response_used: readerResponse.used === true,
    active_engine_update_allowed: false,
    canon_update_allowed: false,
  };

  return {
    ok: true,
    phase: "34A",
    name: "full-neural-writing-pipeline-single-entry-bridge",
    version: fullNeuralWritingPipelineSingleEntryBridgeVersion,
    single_entry_bridge: true,
    status: pipeline.status,
    pipeline_stage: pipeline.pipeline_stage,
    stop_reason: pipeline.stop_reason,
    single_entry_complete: pipeline.status === "completed" && Boolean(pipeline.final_candidate_text),
    final_candidate_text: pipeline.final_candidate_text,
    final_candidate_hash: finalCandidateHash,
    final_candidate_source: pipeline.final_candidate_source,
    candidate_created: pipeline.candidate_created === true,
    candidate_id: pipeline.candidate_id,
    canon_status: "candidate_only",
    adopted: false,
    settled: false,
    output_mode: "chat_text",
    can_output_to_chat: Boolean(pipeline.final_candidate_text),
    next_action: nextAction(pipeline, proofingContext),
    workflow: {
      name: "context_to_candidate_to_optional_proofing",
      steps: workflowSteps,
      deterministic_digest: `sha256:${sha256Json(summary)}`,
    },
    integrated_modules: {
      full_recursive_writing_pipeline: true,
      character_mind_state_ledger: pipeline.character_mind_state_ledger?.used === true,
      dramatic_conflict_manager: pipeline.dramatic_conflict_manager?.used === true,
      foreshadowing_causal_graph: pipeline.foreshadowing_causal_graph?.used === true,
      foreshadowing_payoff_guard: pipeline.foreshadowing_payoff_guard?.used === true,
      foreshadowing_payoff_repair_planner: pipeline.foreshadowing_payoff_repair_planner?.used === true,
      foreshadowing_payoff_acceptance_gate: pipeline.foreshadowing_payoff_acceptance_gate?.used === true,
      reader_response_simulator: readerResponse.used === true,
      aesthetic_memory_context: aestheticMemoryContext.used === true,
      final_polisher: pipeline.final_polisher?.status === "completed",
      candidate_save_bridge: pipeline.candidate_created === true || input.saveCandidate === false,
      proofing_context_bridge: proofingContext.built === true || input.buildProofingContext === false,
    },
    aesthetic_memory_context: aestheticMemoryContext,
    reader_response_simulator: readerResponse,
    proofing_context: proofingContext,
    pipeline_result: pipeline,
    full_neural_orchestration_summary: {
      used: true,
      orchestrator_version: fullNeuralWritingPipelineSingleEntryBridgeVersion,
      pipeline_stage: pipeline.pipeline_stage,
      context_bundle_id: pipeline.report?.trace_ids?.[0] ?? null,
      writing_pipeline_complete: pipeline.status === "completed",
      candidate_only: true,
      active_engine_update_allowed: false,
      canon_update_allowed: false,
    },
    safety: {
      candidate_only: true,
      active_engine_update_allowed: false,
      canon_update_allowed: false,
      direct_adoption_allowed: false,
      approval_confirmed: false,
      adoption_confirmed: false,
      rollback_executed: false,
      recovery_executed: false,
    },
  };
}

export const runFullNeuralWritingPipelineSingleEntry =
  runFullNeuralWritingPipelineSingleEntryBridge;