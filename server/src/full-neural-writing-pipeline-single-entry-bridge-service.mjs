import { createHash } from "node:crypto";
import { buildCandidateProofingContext } from "./candidate-proofing-context-service.mjs";
import { runFullRecursiveWritingPipeline } from "./full-recursive-writing-pipeline-service.mjs";
import { buildReaderResponseSimulatorReport } from "./reader-response-simulator-service.mjs";
import {
  buildFullPipelineAcceptanceEvidencePacketBridgeSurface,
  disabledFullPipelineAcceptanceEvidencePacketBridgeSurface,
} from "./full-pipeline-acceptance-evidence-packet-bridge-surface-service.mjs";
import {
  buildNeuralWritingBrainRequiredModulesContract,
} from "./neural-writing-brain-required-modules-contract-service.mjs";

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
    includeReaderResponseRevisionGate: bool(
      raw,
      "include_reader_response_revision_gate",
      "includeReaderResponseRevisionGate",
      false,
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

function nextAction(pipeline, proofingContext, brainContract = null) {
  if (pipeline.final_candidate_text && brainContract?.contract_valid === false) {
    return "inspect_neural_writing_brain_required_modules_contract";
  }

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

function blockedStageFor(pipeline) {
  const byStopReason = {
    generation_provider_required: "generation_provider_configuration",
    generation_provider_secret_missing: "generation_provider_configuration",
    revision_provider_required: "revision_provider_configuration",
    structural_revision_required: "structural_revision_review",
    max_revision_rounds_exhausted: "recursive_revision_exhausted",
  };
  return byStopReason[pipeline.stop_reason] ?? pipeline.pipeline_stage ?? "pipeline_failure";
}

function failureReasonFor(stopReason, pipelineStage) {
  const reason = text(stopReason) || text(pipelineStage) || "unknown_failure";
  const reasons = {
    generation_provider_required: "Backend generation provider is not configured.",
    generation_provider_secret_missing: "Backend generation provider secret is missing.",
    revision_provider_required: "Backend revision provider is not configured.",
    structural_revision_required: "The candidate still requires structural revision.",
    max_revision_rounds_exhausted: "Recursive revision reached the maximum round limit before acceptance.",
  };
  return reasons[reason] ?? `Pipeline stopped before a final candidate was available: ${reason}.`;
}

function recommendedOperatorActionFor(nextActionValue) {
  const actions = {
    configure_backend_generation_provider:
      "Configure backend generation provider, then rerun the full neural writing pipeline.",
    configure_backend_revision_provider:
      "Configure backend revision provider, then rerun the full neural writing pipeline.",
    review_revision_failure:
      "Review recursive revision failure evidence before deciding whether to adjust revision policy or retry manually.",
    review_pipeline_failure:
      "Review pipeline failure state and warnings before retrying.",
  };
  return actions[nextActionValue] ?? "Review pipeline failure state before retrying.";
}

function buildFailureOutputForChat(pipeline, evidencePacketBridgeSurface, proofingContext, brainContract = null) {
  const hasFinalCandidate = Boolean(pipeline.final_candidate_text);

  if (hasFinalCandidate && brainContract?.contract_valid === false) {
    const operatorDiagnostics = brainContract.operator_diagnostics ?? brainContract.readable_diagnostics ?? null;
    const diagnosticChecklistForOperator = Array.isArray(operatorDiagnostics?.diagnostic_checklist_for_operator)
      ? operatorDiagnostics.diagnostic_checklist_for_operator
      : [];
    const diagnosticChecklistText = diagnosticChecklistForOperator.length
      ? "\n\nDiagnostic checklist: " + diagnosticChecklistForOperator.join(" ")
      : "";
    const diagnosticSummaryForChat =
      (
        operatorDiagnostics?.summary_for_chat
        ?? "Neural writing brain required modules contract invalid. ChatGPT must not output story text because one or more required brain modules were not loaded, used, evidenced, or linked to the final candidate decision."
      ) + diagnosticChecklistText;
    const diagnosticSummaryForOperator =
      operatorDiagnostics?.summary_for_operator
      ?? "Phase36A requires all seven neural writing brain modules to be loaded, used, evidenced, and linked to the final candidate before final output can be valid.";
    const diagnosticOperatorAction =
      operatorDiagnostics?.first_operator_action
      ?? "Inspect neural_writing_brain_required_modules_contract.missing_required_brain_modules and rerun the full neural writing pipeline with every required brain module enabled.";

    return {
      used: true,
      phase: "36A",
      surface_kind: "chatgpt_bridge_failure_output_human_readable_surface",
      status: "blocked_required_brain_modules_contract_invalid",
      pipeline_stage: pipeline.pipeline_stage ?? "unknown_stage",
      stop_reason: "required_brain_modules_contract_invalid",
      blocked_stage: "neural_writing_brain_required_modules_contract",
      next_action: "inspect_neural_writing_brain_required_modules_contract",
      can_output_to_chat: false,
      must_not_output_candidate: true,
      must_not_output_candidate_reason: "required_brain_modules_contract_invalid",
      failure_summary_for_chat: diagnosticSummaryForChat,
      failure_reason_for_operator: diagnosticSummaryForOperator,
      recommended_operator_action: diagnosticOperatorAction,
      diagnostic_summary_for_chat: diagnosticSummaryForChat,
      diagnostic_summary_for_operator: diagnosticSummaryForOperator,
      operator_diagnostics: operatorDiagnostics,
      blocked_module_diagnostics: Array.isArray(operatorDiagnostics?.blocked_module_diagnostics)
        ? operatorDiagnostics.blocked_module_diagnostics
        : [],
      diagnostic_checklist_for_operator: Array.isArray(operatorDiagnostics?.diagnostic_checklist_for_operator)
        ? operatorDiagnostics.diagnostic_checklist_for_operator
        : [],
      can_retry_after_configuration: true,
      can_continue_revision: false,
      evidence_surface_available: evidencePacketBridgeSurface?.used === true,
      evidence_final_status: evidencePacketBridgeSurface?.acceptance_summary?.final_status ?? null,
      required_brain_modules_contract_valid: false,
      missing_required_brain_modules: brainContract.missing_required_brain_modules ?? [],
      validation_errors: brainContract.validation_errors ?? [],
      safety: {
        candidate_only: true,
        no_candidate_save: true,
        no_approval: true,
        no_adoption: true,
        no_canon_update: true,
        no_active_engine_update: true,
        can_modify_active_engine: false,
        can_update_canon: false,
        can_confirm_adoption: false,
      },
      warnings: Array.isArray(pipeline.report?.warnings) ? pipeline.report.warnings : [],
    };
  }

  if (hasFinalCandidate) {
    return {
      used: false,
      phase: "34L",
      surface_kind: "chatgpt_bridge_failure_output_human_readable_surface",
      status: "not_needed",
      reason: "final_candidate_available",
      can_output_to_chat: true,
      must_not_output_candidate: false,
      next_action: nextAction(pipeline, proofingContext),
      warnings: [],
    };
  }

  const action = nextAction(pipeline, proofingContext);
  const stopReason = text(pipeline.stop_reason) || "unknown_failure";
  const pipelineStage = text(pipeline.pipeline_stage) || "unknown_stage";
  const evidenceAvailable = evidencePacketBridgeSurface?.used === true;
  const evidenceFinalStatus = evidencePacketBridgeSurface?.acceptance_summary?.final_status ?? null;
  const revisionRoundsAttempted = pipeline.recursive_revision?.rounds_attempted ?? 0;
  const maxRevisionRounds = pipeline.recursive_revision?.max_revision_rounds ?? null;

  return {
    used: true,
    phase: "34L",
    surface_kind: "chatgpt_bridge_failure_output_human_readable_surface",
    status: pipeline.status ?? "failed",
    pipeline_stage: pipelineStage,
    stop_reason: stopReason,
    blocked_stage: blockedStageFor(pipeline),
    next_action: action,
    can_output_to_chat: false,
    must_not_output_candidate: true,
    must_not_output_candidate_reason: "final_candidate_text_missing",
    failure_summary_for_chat:
      `The writing pipeline stopped at ${pipelineStage} because ${stopReason}. No final candidate text is available, so ChatGPT must not output story text.`,
    failure_reason_for_operator: failureReasonFor(stopReason, pipelineStage),
    recommended_operator_action: recommendedOperatorActionFor(action),
    can_retry_after_configuration:
      action === "configure_backend_generation_provider"
      || action === "configure_backend_revision_provider",
    can_continue_revision:
      action === "review_revision_failure"
      && stopReason !== "max_revision_rounds_exhausted",
    evidence_surface_available: evidenceAvailable,
    evidence_final_status: evidenceFinalStatus,
    rewrite_targets: Array.isArray(evidencePacketBridgeSurface?.rewrite_targets)
      ? evidencePacketBridgeSurface.rewrite_targets
      : [],
    operator_findings_count: Array.isArray(evidencePacketBridgeSurface?.operator_findings)
      ? evidencePacketBridgeSurface.operator_findings.length
      : 0,
    revision_rounds_attempted: revisionRoundsAttempted,
    max_revision_rounds: maxRevisionRounds,
    safety: {
      candidate_only: true,
      no_candidate_save: true,
      no_approval: true,
      no_adoption: true,
      no_canon_update: true,
      no_active_engine_update: true,
      can_modify_active_engine: false,
      can_update_canon: false,
      can_confirm_adoption: false,
    },
    warnings: Array.isArray(pipeline.report?.warnings) ? pipeline.report.warnings : [],
  };
}

function buildSuccessOutputForChat(
  pipeline,
  evidencePacketBridgeSurface,
  readerResponse,
  proofingContext,
  finalCandidateHash,
  brainContract = null,
) {
  const hasFinalCandidate = Boolean(pipeline.final_candidate_text);
  const action = nextAction(pipeline, proofingContext, brainContract);

  if (hasFinalCandidate && brainContract?.contract_valid === false) {
    return {
      used: false,
      phase: "34M",
      surface_kind: "chatgpt_bridge_success_output_human_readable_surface",
      status: "not_available",
      reason: "required_brain_modules_contract_invalid",
      can_output_to_chat: false,
      must_output_exact_final_candidate_text: false,
      next_action: "inspect_neural_writing_brain_required_modules_contract",
      warnings: [],
    };
  }

  if (!hasFinalCandidate) {
    return {
      used: false,
      phase: "34M",
      surface_kind: "chatgpt_bridge_success_output_human_readable_surface",
      status: "not_available",
      reason: "final_candidate_text_missing",
      can_output_to_chat: false,
      must_output_exact_final_candidate_text: false,
      next_action: action,
      warnings: [],
    };
  }

  const evidenceAvailable = evidencePacketBridgeSurface?.used === true;
  const evidenceFinalStatus = evidencePacketBridgeSurface?.acceptance_summary?.final_status ?? null;
  const accepted = evidencePacketBridgeSurface?.acceptance_summary?.accepted === true;
  const revisionRoundsAttempted = pipeline.recursive_revision?.rounds_attempted ?? 0;
  const maxRevisionRounds = pipeline.recursive_revision?.max_revision_rounds ?? null;
  const finalCandidateSource = pipeline.final_candidate_source ?? null;

  return {
    used: true,
    phase: "34M",
    surface_kind: "chatgpt_bridge_success_output_human_readable_surface",
    status: action === "output_final_candidate_text_to_chat"
      ? "ready_to_output_final_candidate_text"
      : "final_candidate_available_review_required",
    pipeline_stage: pipeline.pipeline_stage ?? "unknown_stage",
    stop_reason: pipeline.stop_reason ?? null,
    next_action: action,
    can_output_to_chat: true,
    must_output_exact_final_candidate_text: action === "output_final_candidate_text_to_chat",
    must_output_exact_final_candidate_text_reason:
      action === "output_final_candidate_text_to_chat"
        ? "final_candidate_text_ready_after_full_pipeline_acceptance"
        : "next_action_requires_review_before_output",
    final_candidate_text_to_output: pipeline.final_candidate_text,
    final_candidate_hash: finalCandidateHash,
    final_candidate_source: finalCandidateSource,
    final_candidate_length: pipeline.final_candidate_text.length,
    final_candidate_ready_summary:
      `Final candidate text is ready from ${finalCandidateSource ?? "unknown_source"} at ${pipeline.pipeline_stage ?? "unknown_stage"}.`,
    success_summary_for_chat:
      action === "output_final_candidate_text_to_chat"
        ? "The full neural writing pipeline produced an accepted final candidate. ChatGPT should output final_candidate_text exactly as provided, without rewriting, summarizing, or saving it as canon."
        : "The full neural writing pipeline produced final candidate text, but the next action requires review before direct output.",
    reader_acceptance_summary_for_chat: {
      reader_response_used: readerResponse.used === true,
      reader_response_status: readerResponse.status ?? null,
      accepted,
      final_status: evidenceFinalStatus,
      revision_required_initially:
        evidencePacketBridgeSurface?.acceptance_summary?.revision_required_initially ?? null,
      revision_required_finally:
        evidencePacketBridgeSurface?.acceptance_summary?.revision_required_finally ?? null,
      soft_acceptance_reached:
        evidencePacketBridgeSurface?.acceptance_summary?.soft_acceptance_reached ?? null,
    },
    revision_summary_for_chat: {
      recursive_revision_used:
        evidencePacketBridgeSurface?.acceptance_summary?.recursive_revision_used ?? false,
      revision_rounds_attempted: revisionRoundsAttempted,
      max_revision_rounds: maxRevisionRounds,
      final_candidate_source: finalCandidateSource,
    },
    evidence_packet_summary_for_chat: {
      evidence_surface_available: evidenceAvailable,
      evidence_final_status: evidenceFinalStatus,
      bridge_surface_status: evidencePacketBridgeSurface?.status ?? null,
      operator_findings_count: Array.isArray(evidencePacketBridgeSurface?.operator_findings)
        ? evidencePacketBridgeSurface.operator_findings.length
        : 0,
      rewrite_targets_count: Array.isArray(evidencePacketBridgeSurface?.rewrite_targets)
        ? evidencePacketBridgeSurface.rewrite_targets.length
        : 0,
    },
    candidate_output_contract: {
      output_field: "final_candidate_text",
      must_output_exact: action === "output_final_candidate_text_to_chat",
      may_rewrite: false,
      may_summarize: false,
      may_save_candidate: false,
      may_approve: false,
      may_adopt: false,
      may_update_canon: false,
      may_update_active_engine: false,
      output_mode: "chat_text",
      final_candidate_hash: finalCandidateHash,
      final_candidate_source: finalCandidateSource,
    },
    safety: {
      candidate_only: true,
      no_candidate_save: true,
      no_approval: true,
      no_adoption: true,
      no_canon_update: true,
      no_active_engine_update: true,
      can_modify_active_engine: false,
      can_update_canon: false,
      can_confirm_adoption: false,
    },
    warnings: Array.isArray(pipeline.report?.warnings) ? pipeline.report.warnings : [],
  };
}


function finalResponseSafetyBoundary() {
  return {
    candidate_only: true,
    no_candidate_save: true,
    no_approval: true,
    no_adoption: true,
    no_canon_update: true,
    no_active_engine_update: true,
    can_modify_active_engine: false,
    can_update_canon: false,
    can_confirm_adoption: false,
  };
}

function buildFinalResponseForChat(successOutputForChat, failureOutputForChat) {
  if (successOutputForChat?.used === true) {
    const body = successOutputForChat.final_candidate_text_to_output ?? "";
    const bodyHash = successOutputForChat.final_candidate_hash || (
      body ? createHash("sha256").update(body).digest("hex") : ""
    );

    return {
      used: true,
      phase: "34O",
      surface_kind: "chatgpt_bridge_final_response_renderer_contract",
      response_kind: "final_candidate_text",
      can_output_to_chat: true,
      body,
      body_hash: bodyHash,
      source_surface: "success_output_for_chat",
      must_output_body_exactly: true,
      may_include_extra_explanation: false,
      may_rewrite: false,
      may_summarize: false,
      may_output_story_text: true,
      safety: finalResponseSafetyBoundary(),
    };
  }

  if (failureOutputForChat?.used === true) {
    const body = [
      failureOutputForChat.failure_summary_for_chat,
      failureOutputForChat.recommended_operator_action
        ? "Recommended operator action: " + failureOutputForChat.recommended_operator_action
        : "",
    ].filter(Boolean).join("\n\n");

    return {
      used: true,
      phase: "34O",
      surface_kind: "chatgpt_bridge_final_response_renderer_contract",
      response_kind: "pipeline_failure_notice",
      can_output_to_chat: false,
      body,
      body_hash: body ? createHash("sha256").update(body).digest("hex") : "",
      source_surface: "failure_output_for_chat",
      must_output_body_exactly: true,
      may_include_extra_explanation: false,
      may_rewrite: false,
      may_summarize: false,
      may_output_story_text: false,
      safety: finalResponseSafetyBoundary(),
    };
  }

  return {
    used: false,
    phase: "34O",
    surface_kind: "chatgpt_bridge_final_response_renderer_contract",
    response_kind: "unavailable",
    can_output_to_chat: false,
    body: "",
    body_hash: "",
    source_surface: null,
    must_output_body_exactly: false,
    may_include_extra_explanation: false,
    may_rewrite: false,
    may_summarize: false,
    may_output_story_text: false,
    safety: finalResponseSafetyBoundary(),
  };
}


function sha256Text(value) {
  return createHash("sha256").update(String(value ?? "")).digest("hex");
}

function invalidFinalResponseHandoffForChat(validationErrors, finalResponseForChat = null) {
  const errors = Array.isArray(validationErrors)
    ? validationErrors.filter(Boolean)
    : [String(validationErrors ?? "unknown_contract_error")];
  const reason = errors.join(",");
  const body =
    "Final response handoff blocked: " + reason
    + ". Operator action: inspect final_response_for_chat contract, then rerun or repair the ChatGPT bridge pipeline.";

  return {
    used: true,
    phase: "34P",
    surface_kind: "chatgpt_bridge_final_response_handoff_contract",
    status: "blocked_contract_invalid",
    response_kind: "contract_invalid_notice",
    can_output_to_chat: false,
    can_emit_response_to_chat: true,
    chatgpt_must_output_body: true,
    final_output_source: null,
    body,
    body_hash: sha256Text(body),
    source_surface: "final_response_for_chat",
    source_response_kind: finalResponseForChat?.response_kind ?? null,
    source_response_surface: finalResponseForChat?.source_surface ?? null,
    must_output_body_exactly: true,
    may_include_extra_explanation: false,
    may_rewrite: false,
    may_summarize: false,
    may_output_story_text: false,
    may_fallback_to_final_candidate_text: false,
    may_fallback_to_success_output: false,
    may_fallback_to_failure_output: false,
    may_construct_response: false,
    contract_valid: false,
    validation_errors: errors,
    operator_action: "inspect_final_response_for_chat_contract",
    safety: finalResponseSafetyBoundary(),
  };
}

export function buildFinalResponseHandoffForChat(finalResponseForChat) {
  const errors = [];

  if (finalResponseForChat?.used !== true) {
    errors.push("final_response_for_chat_used_false_or_missing");
  }

  const body = typeof finalResponseForChat?.body === "string"
    ? finalResponseForChat.body
    : "";
  const expectedHash = sha256Text(body);
  const responseKind = finalResponseForChat?.response_kind ?? null;

  if (!body) errors.push("final_response_body_missing");
  if (finalResponseForChat?.body_hash !== expectedHash) {
    errors.push("final_response_body_hash_mismatch");
  }

  if (!["final_candidate_text", "pipeline_failure_notice"].includes(responseKind)) {
    errors.push("final_response_kind_invalid");
  }

  if (
    responseKind === "final_candidate_text"
    && finalResponseForChat?.source_surface !== "success_output_for_chat"
  ) {
    errors.push("final_candidate_text_source_surface_invalid");
  }

  if (
    responseKind === "pipeline_failure_notice"
    && finalResponseForChat?.source_surface !== "failure_output_for_chat"
  ) {
    errors.push("pipeline_failure_notice_source_surface_invalid");
  }

  if (finalResponseForChat?.must_output_body_exactly !== true) {
    errors.push("must_output_body_exactly_not_true");
  }

  if (finalResponseForChat?.may_include_extra_explanation !== false) {
    errors.push("may_include_extra_explanation_not_false");
  }

  if (finalResponseForChat?.may_rewrite !== false) {
    errors.push("may_rewrite_not_false");
  }

  if (finalResponseForChat?.may_summarize !== false) {
    errors.push("may_summarize_not_false");
  }

  if (
    responseKind === "final_candidate_text"
    && finalResponseForChat?.may_output_story_text !== true
  ) {
    errors.push("final_candidate_text_story_output_not_allowed");
  }

  if (
    responseKind === "pipeline_failure_notice"
    && finalResponseForChat?.may_output_story_text !== false
  ) {
    errors.push("pipeline_failure_notice_story_output_allowed");
  }

  if (errors.length) {
    return invalidFinalResponseHandoffForChat(errors, finalResponseForChat);
  }

  return {
    used: true,
    phase: "34P",
    surface_kind: "chatgpt_bridge_final_response_handoff_contract",
    status: responseKind === "final_candidate_text"
      ? "ready_to_handoff_final_candidate_text"
      : "ready_to_handoff_pipeline_failure_notice",
    response_kind: responseKind,
    can_output_to_chat: finalResponseForChat.can_output_to_chat === true,
    can_emit_response_to_chat: true,
    chatgpt_must_output_body: true,
    final_output_source: "final_response_for_chat.body",
    body,
    body_hash: expectedHash,
    source_surface: "final_response_for_chat",
    source_response_kind: responseKind,
    source_response_surface: finalResponseForChat.source_surface,
    must_output_body_exactly: true,
    may_include_extra_explanation: false,
    may_rewrite: false,
    may_summarize: false,
    may_output_story_text: responseKind === "final_candidate_text",
    may_fallback_to_final_candidate_text: false,
    may_fallback_to_success_output: false,
    may_fallback_to_failure_output: false,
    may_construct_response: false,
    contract_valid: true,
    validation_errors: [],
    operator_action: null,
    safety: finalResponseSafetyBoundary(),
  };
}


function invalidExtractedChatGptFinalOutput(validationErrors, finalResponseHandoffForChat = null) {
  const errors = Array.isArray(validationErrors)
    ? validationErrors.filter(Boolean)
    : [String(validationErrors ?? "unknown_extraction_contract_error")];
  const reason = errors.join(",");
  const outputText =
    "Final output extraction blocked: " + reason
    + ". Operator action: inspect final_response_handoff_for_chat contract, then rerun or repair the ChatGPT bridge final output extraction.";

  return {
    used: true,
    phase: "34Q",
    surface_kind: "chatgpt_bridge_final_output_live_extraction_contract",
    status: "blocked_extraction_contract_invalid",
    response_kind: "extraction_contract_invalid_notice",
    can_output_to_chat: false,
    can_emit_response_to_chat: true,
    output_text: outputText,
    output_hash: sha256Text(outputText),
    output_source: null,
    final_output_source: null,
    source_surface: "final_response_handoff_for_chat",
    source_response_kind: finalResponseHandoffForChat?.response_kind ?? null,
    source_handoff_status: finalResponseHandoffForChat?.status ?? null,
    handoff_contract_valid: finalResponseHandoffForChat?.contract_valid === true,
    must_emit_exactly: true,
    no_extra_text: true,
    no_fallback: true,
    may_include_extra_explanation: false,
    may_rewrite: false,
    may_summarize: false,
    may_output_story_text: false,
    may_fallback_to_final_candidate_text: false,
    may_fallback_to_success_output: false,
    may_fallback_to_failure_output: false,
    may_fallback_to_final_response: false,
    may_construct_response: false,
    extraction_contract_valid: false,
    validation_errors: errors,
    operator_action: "inspect_final_response_handoff_for_chat_contract",
    safety: finalResponseSafetyBoundary(),
  };
}

export function buildExtractedChatGptFinalOutput(finalResponseHandoffForChat) {
  const errors = [];

  if (finalResponseHandoffForChat?.used !== true) {
    errors.push("final_response_handoff_used_false_or_missing");
  }

  const outputText = typeof finalResponseHandoffForChat?.body === "string"
    ? finalResponseHandoffForChat.body
    : "";
  const expectedHash = sha256Text(outputText);
  const responseKind = finalResponseHandoffForChat?.response_kind ?? null;

  if (!outputText) errors.push("final_response_handoff_body_missing");
  if (finalResponseHandoffForChat?.body_hash !== expectedHash) {
    errors.push("final_response_handoff_body_hash_mismatch");
  }

  if (!["final_candidate_text", "pipeline_failure_notice", "contract_invalid_notice"].includes(responseKind)) {
    errors.push("final_response_handoff_kind_invalid");
  }

  if (finalResponseHandoffForChat?.chatgpt_must_output_body !== true) {
    errors.push("chatgpt_must_output_body_not_true");
  }

  if (finalResponseHandoffForChat?.must_output_body_exactly !== true) {
    errors.push("must_output_body_exactly_not_true");
  }

  if (finalResponseHandoffForChat?.may_include_extra_explanation !== false) {
    errors.push("may_include_extra_explanation_not_false");
  }

  if (finalResponseHandoffForChat?.may_rewrite !== false) {
    errors.push("may_rewrite_not_false");
  }

  if (finalResponseHandoffForChat?.may_summarize !== false) {
    errors.push("may_summarize_not_false");
  }

  if (finalResponseHandoffForChat?.may_fallback_to_final_candidate_text !== false) {
    errors.push("may_fallback_to_final_candidate_text_not_false");
  }

  if (finalResponseHandoffForChat?.may_fallback_to_success_output !== false) {
    errors.push("may_fallback_to_success_output_not_false");
  }

  if (finalResponseHandoffForChat?.may_fallback_to_failure_output !== false) {
    errors.push("may_fallback_to_failure_output_not_false");
  }

  if (finalResponseHandoffForChat?.may_construct_response !== false) {
    errors.push("may_construct_response_not_false");
  }

  if (
    responseKind === "final_candidate_text"
    && finalResponseHandoffForChat?.contract_valid !== true
  ) {
    errors.push("final_candidate_text_handoff_contract_not_valid");
  }

  if (
    responseKind === "pipeline_failure_notice"
    && finalResponseHandoffForChat?.contract_valid !== true
  ) {
    errors.push("pipeline_failure_notice_handoff_contract_not_valid");
  }

  if (
    responseKind === "contract_invalid_notice"
    && finalResponseHandoffForChat?.contract_valid !== false
  ) {
    errors.push("contract_invalid_notice_handoff_contract_not_invalid");
  }

  if (
    responseKind === "final_candidate_text"
    && finalResponseHandoffForChat?.may_output_story_text !== true
  ) {
    errors.push("final_candidate_text_story_output_not_allowed");
  }

  if (
    ["pipeline_failure_notice", "contract_invalid_notice"].includes(responseKind)
    && finalResponseHandoffForChat?.may_output_story_text !== false
  ) {
    errors.push("notice_story_output_allowed");
  }

  if (errors.length) {
    return invalidExtractedChatGptFinalOutput(errors, finalResponseHandoffForChat);
  }

  const statusByKind = {
    final_candidate_text: "ready_to_emit_final_candidate_text",
    pipeline_failure_notice: "ready_to_emit_pipeline_failure_notice",
    contract_invalid_notice: "ready_to_emit_contract_invalid_notice",
  };

  return {
    used: true,
    phase: "34Q",
    surface_kind: "chatgpt_bridge_final_output_live_extraction_contract",
    status: statusByKind[responseKind],
    response_kind: responseKind,
    can_output_to_chat: finalResponseHandoffForChat.can_output_to_chat === true,
    can_emit_response_to_chat: true,
    output_text: outputText,
    output_hash: expectedHash,
    output_source: "final_response_handoff_for_chat.body",
    final_output_source: "final_response_handoff_for_chat.body",
    source_surface: "final_response_handoff_for_chat",
    source_response_kind: responseKind,
    source_handoff_status: finalResponseHandoffForChat.status ?? null,
    handoff_contract_valid: finalResponseHandoffForChat.contract_valid === true,
    must_emit_exactly: true,
    no_extra_text: true,
    no_fallback: true,
    may_include_extra_explanation: false,
    may_rewrite: false,
    may_summarize: false,
    may_output_story_text: responseKind === "final_candidate_text",
    may_fallback_to_final_candidate_text: false,
    may_fallback_to_success_output: false,
    may_fallback_to_failure_output: false,
    may_fallback_to_final_response: false,
    may_construct_response: false,
    extraction_contract_valid: true,
    validation_errors: [],
    operator_action: responseKind === "contract_invalid_notice"
      ? finalResponseHandoffForChat.operator_action
      : null,
    safety: finalResponseSafetyBoundary(),
  };
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
    include_reader_response_revision_gate: input.includeReaderResponseRevisionGate,
    dramatic_conflict_plan: Object.keys(input.readerResponseConflictPlan).length
      ? input.readerResponseConflictPlan
      : (rawInput.dramatic_conflict_plan ?? rawInput.dramaticConflictPlan),
    reader_questions_to_carry_forward: input.readerQuestionsToCarryForward,
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

  const evidencePacketBridgeSurface = pipeline.full_pipeline_acceptance_evidence_packet
    ? buildFullPipelineAcceptanceEvidencePacketBridgeSurface({
      full_pipeline_acceptance_evidence_packet: pipeline.full_pipeline_acceptance_evidence_packet,
      pipeline_result: pipeline,
    }, {
      bridge_surface: "chatgpt_bridge_single_entry",
    })
    : disabledFullPipelineAcceptanceEvidencePacketBridgeSurface("source_packet_unavailable");

  const workflowSteps = buildWorkflowSteps(
    pipeline,
    readerResponse,
    proofingContext,
    aestheticMemoryContext,
  );

  workflowSteps.splice(6, 0, {
    key: "acceptance_evidence_packet_bridge_surface",
    label: "Surface acceptance evidence packet",
    completed: evidencePacketBridgeSurface.used === true,
    status: evidencePacketBridgeSurface.status,
    final_status: evidencePacketBridgeSurface.acceptance_summary?.final_status ?? null,
  });

  const finalCandidateHash = pipeline.final_candidate_hash || (
    pipeline.final_candidate_text
      ? createHash("sha256").update(pipeline.final_candidate_text).digest("hex")
      : ""
  );

  const brainContract = buildNeuralWritingBrainRequiredModulesContract({
    pipeline_result: pipeline,
    reader_response_simulator: readerResponse,
    aesthetic_memory_context: aestheticMemoryContext,
    workflow: {
      name: "context_to_candidate_to_optional_proofing",
      steps: workflowSteps,
    },
    final_candidate_text: pipeline.final_candidate_text,
    final_candidate_hash: finalCandidateHash,
    final_candidate_decision: nextAction(pipeline, proofingContext),
    final_candidate_decision_source: "runFullNeuralWritingPipelineSingleEntryBridge.nextAction",
    single_entry_bridge: true,
    single_entry_bridge_version: fullNeuralWritingPipelineSingleEntryBridgeVersion,
    single_entry_status: pipeline.status,
  });

  const failureOutputForChat = buildFailureOutputForChat(
    pipeline,
    evidencePacketBridgeSurface,
    proofingContext,
    brainContract,
  );

  const successOutputForChat = buildSuccessOutputForChat(
    pipeline,
    evidencePacketBridgeSurface,
    readerResponse,
    proofingContext,
    finalCandidateHash,
    brainContract,
  );

  const finalResponseForChat = buildFinalResponseForChat(
    successOutputForChat,
    failureOutputForChat,
  );

  const finalResponseHandoffForChat = buildFinalResponseHandoffForChat(finalResponseForChat);
  const extractedChatgptFinalOutput = buildExtractedChatGptFinalOutput(finalResponseHandoffForChat);

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
    failure_output_surface_used: failureOutputForChat.used === true,
    failure_output_next_action: failureOutputForChat.used === true ? failureOutputForChat.next_action : null,
    failure_output_blocked_stage: failureOutputForChat.used === true ? failureOutputForChat.blocked_stage : null,
    success_output_surface_used: successOutputForChat.used === true,
    success_output_next_action: successOutputForChat.used === true ? successOutputForChat.next_action : null,
    success_output_final_candidate_hash: successOutputForChat.used === true ? successOutputForChat.final_candidate_hash : null,
    final_response_surface_used: finalResponseForChat.used === true,
    final_response_kind: finalResponseForChat.used === true ? finalResponseForChat.response_kind : null,
    final_response_body_hash: finalResponseForChat.used === true ? finalResponseForChat.body_hash : null,
    final_response_handoff_used: finalResponseHandoffForChat.used === true,
    final_response_handoff_valid: finalResponseHandoffForChat.contract_valid === true,
    final_response_handoff_kind: finalResponseHandoffForChat.used === true ? finalResponseHandoffForChat.response_kind : null,
    final_response_handoff_body_hash: finalResponseHandoffForChat.used === true ? finalResponseHandoffForChat.body_hash : null,
    extracted_chatgpt_final_output_used: extractedChatgptFinalOutput.used === true,
    extracted_chatgpt_final_output_valid: extractedChatgptFinalOutput.extraction_contract_valid === true,
    extracted_chatgpt_final_output_kind: extractedChatgptFinalOutput.used === true ? extractedChatgptFinalOutput.response_kind : null,
    extracted_chatgpt_final_output_hash: extractedChatgptFinalOutput.used === true ? extractedChatgptFinalOutput.output_hash : null,
    extracted_chatgpt_final_output_source: extractedChatgptFinalOutput.used === true ? extractedChatgptFinalOutput.output_source : null,
    neural_writing_brain_required_modules_contract_valid: brainContract.contract_valid === true,
    required_brain_modules_count: brainContract.required_brain_modules_count,
    missing_required_brain_modules: brainContract.missing_required_brain_modules,
    brain_contract_can_emit_final_output: brainContract.can_emit_final_output === true,
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
    can_output_to_chat: Boolean(pipeline.final_candidate_text) && brainContract.can_emit_final_output === true,
    next_action: nextAction(pipeline, proofingContext, brainContract),
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
      full_pipeline_acceptance_evidence_packet_bridge_surface: evidencePacketBridgeSurface.used === true,
      neural_writing_brain_required_modules_contract: brainContract.used === true,
      aesthetic_memory_context: aestheticMemoryContext.used === true,
      final_polisher: pipeline.final_polisher?.status === "completed",
      candidate_save_bridge: pipeline.candidate_created === true || input.saveCandidate === false,
      proofing_context_bridge: proofingContext.built === true || input.buildProofingContext === false,
    },
    aesthetic_memory_context: aestheticMemoryContext,
    reader_response_simulator: readerResponse,
    full_pipeline_acceptance_evidence_packet: pipeline.full_pipeline_acceptance_evidence_packet ?? null,
    full_pipeline_acceptance_evidence_packet_bridge_surface: evidencePacketBridgeSurface,
    neural_writing_brain_required_modules_contract: brainContract,
    failure_output_for_chat: failureOutputForChat,
    success_output_for_chat: successOutputForChat,
    final_response_for_chat: finalResponseForChat,
    final_response_handoff_for_chat: finalResponseHandoffForChat,
    extracted_chatgpt_final_output: extractedChatgptFinalOutput,
    proofing_context: proofingContext,
    pipeline_result: pipeline,
    full_neural_orchestration_summary: {
      used: true,
      orchestrator_version: fullNeuralWritingPipelineSingleEntryBridgeVersion,
      pipeline_stage: pipeline.pipeline_stage,
      context_bundle_id: pipeline.report?.trace_ids?.[0] ?? null,
      writing_pipeline_complete: pipeline.status === "completed",
      acceptance_evidence_packet_bridge_surface_used: evidencePacketBridgeSurface.used === true,
      acceptance_evidence_final_status: evidencePacketBridgeSurface.acceptance_summary?.final_status ?? null,
      failure_output_surface_used: failureOutputForChat.used === true,
      failure_output_next_action: failureOutputForChat.used === true ? failureOutputForChat.next_action : null,
      failure_output_blocked_stage: failureOutputForChat.used === true ? failureOutputForChat.blocked_stage : null,
      success_output_surface_used: successOutputForChat.used === true,
      success_output_next_action: successOutputForChat.used === true ? successOutputForChat.next_action : null,
      success_output_final_candidate_hash: successOutputForChat.used === true ? successOutputForChat.final_candidate_hash : null,
      final_response_surface_used: finalResponseForChat.used === true,
      final_response_kind: finalResponseForChat.used === true ? finalResponseForChat.response_kind : null,
      final_response_body_hash: finalResponseForChat.used === true ? finalResponseForChat.body_hash : null,
      final_response_handoff_used: finalResponseHandoffForChat.used === true,
      final_response_handoff_valid: finalResponseHandoffForChat.contract_valid === true,
      final_response_handoff_kind: finalResponseHandoffForChat.used === true ? finalResponseHandoffForChat.response_kind : null,
      final_response_handoff_body_hash: finalResponseHandoffForChat.used === true ? finalResponseHandoffForChat.body_hash : null,
      extracted_chatgpt_final_output_used: extractedChatgptFinalOutput.used === true,
      extracted_chatgpt_final_output_valid: extractedChatgptFinalOutput.extraction_contract_valid === true,
      extracted_chatgpt_final_output_kind: extractedChatgptFinalOutput.used === true ? extractedChatgptFinalOutput.response_kind : null,
      extracted_chatgpt_final_output_hash: extractedChatgptFinalOutput.used === true ? extractedChatgptFinalOutput.output_hash : null,
      extracted_chatgpt_final_output_source: extractedChatgptFinalOutput.used === true ? extractedChatgptFinalOutput.output_source : null,
      neural_writing_brain_required_modules_contract_valid: brainContract.contract_valid === true,
      required_brain_modules_count: brainContract.required_brain_modules_count,
      missing_required_brain_modules: brainContract.missing_required_brain_modules,
      brain_contract_can_emit_final_output: brainContract.can_emit_final_output === true,
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