import { createHash } from "node:crypto";
import { buildFullNeuralWritingOrchestration } from "./full-neural-writing-orchestrator-service.mjs";
import { runFinalPolisherEditorialBrain } from "./final-polisher-editorial-service.mjs";
import { saveChatOutputAsWritingCandidate } from "./chat-output-candidate-service.mjs";
import { evaluateCharacterVoiceDrift } from "./character-voice-drift-guard-service.mjs";
import { formatCharacterVoiceGuardForDisplay } from "./character-voice-guard-display.mjs";
import { buildCharacterMindStateLedgerContext } from "./character-mind-state-ledger-service.mjs";
import { buildDramaticConflictManagerContext } from "./dramatic-conflict-manager-service.mjs";
import {
  buildGenerationAdapterFromProvider,
  buildRevisionAdapterFromProvider,
  resolveBackendGenerationProvider,
} from "./backend-generation-provider-service.mjs";
import {
  buildRecursiveRevisionPolicy,
} from "./recursive-revision-policy-service.mjs";
import {
  buildReaderResponseSimulatorReport,
  readerResponseSimulatorVersion,
} from "./reader-response-simulator-service.mjs";
import {
  buildReaderResponseRevisionGate,
  disabledReaderResponseRevisionGate,
} from "./reader-response-revision-gate-service.mjs";
import {
  buildFullPipelineAcceptanceEvidencePacket,
  disabledFullPipelineAcceptanceEvidencePacket,
} from "./full-pipeline-acceptance-evidence-packet-service.mjs";

function sha256(value) {
  return createHash("sha256").update(String(value ?? "")).digest("hex");
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function arrayOfText(value, maximum = 20) {
  const raw = Array.isArray(value) ? value : [];
  return raw
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object") {
        return text(item.character_name ?? item.characterName ?? item.canonical_name ?? item.name);
      }
      return "";
    })
    .filter(Boolean)
    .slice(0, maximum);
}

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function phase27bObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function phase27cObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function phase27dObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function phase27eObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function optionObjectEnabled(value) {
  if (value === true) return true;
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function shouldUseForeshadowingCausalGraph(rawInput, input, options) {
  return input.includeForeshadowingCausalGraph === true
    || optionObjectEnabled(options.foreshadowingCausalGraph)
    || optionObjectEnabled(options.foreshadowing_causal_graph);
}

function shouldUseForeshadowingPayoffGuard(rawInput, input, options) {
  return input.includeForeshadowingPayoffGuard === true
    || optionObjectEnabled(options.foreshadowingPayoffGuard)
    || optionObjectEnabled(options.foreshadowing_payoff_guard);
}

function shouldUseForeshadowingPayoffRepairPlanner(rawInput, input, options) {
  return input.includeForeshadowingPayoffRepairPlanner === true
    || optionObjectEnabled(options.foreshadowingPayoffRepairPlanner)
    || optionObjectEnabled(options.foreshadowing_payoff_repair_planner);
}

function shouldUseForeshadowingPayoffAcceptanceGate(rawInput, input, options) {
  return input.includeForeshadowingPayoffAcceptanceGate === true
    || optionObjectEnabled(options.foreshadowingPayoffAcceptanceGate)
    || optionObjectEnabled(options.foreshadowing_payoff_acceptance_gate);
}

function shouldUseForeshadowingSettlementDiffPreview(rawInput, input, options) {
  return input.includeForeshadowingSettlementDiffPreview === true
    || optionObjectEnabled(options.foreshadowingSettlementDiffPreview)
    || optionObjectEnabled(options.foreshadowing_settlement_diff_preview);
}

function shouldUseReaderResponseRevisionGate(rawInput, input, options) {
  return input.includeReaderResponseRevisionGate === true
    || optionObjectEnabled(options.readerResponseRevisionGate)
    || optionObjectEnabled(options.reader_response_revision_gate);
}

function disabledForeshadowingPayoffGuard(status = "disabled") {
  return {
    used: false,
    phase: "27B",
    version: "foreshadowing_payoff_guard_v1",
    status,
    read_only: true,
    candidate_only: true,
    no_auto_persist: true,
    no_canon_update: true,
    no_active_engine_update: true,
    detected_payoffs: [],
    fake_payoffs: [],
    unpaid_required_debts: [],
    unresolved_promises: [],
    payoff_quality_score: 0,
    blocking: false,
    warnings: [],
  };
}

function disabledForeshadowingPayoffRepairPlanner(status = "disabled") {
  return {
    used: false,
    phase: "27C",
    version: "foreshadowing_payoff_repair_planner_v1",
    status,
    read_only: true,
    candidate_only: true,
    no_auto_persist: true,
    no_canon_update: true,
    no_active_engine_update: true,
    revision_required: false,
    repair_tasks: [],
    revision_plan_patch: null,
    final_polisher_guidance: null,
    provider_guidance: null,
    warnings: [],
  };
}

function disabledForeshadowingPayoffAcceptanceGate(status = "disabled") {
  return {
    used: false,
    phase: "27D",
    version: "foreshadowing_payoff_acceptance_gate_v1",
    status,
    readiness_status: "not_evaluated",
    can_enter_adoption_review: false,
    requires_human_approval: true,
    direct_adoption_allowed: false,
    read_only: true,
    candidate_only: true,
    no_auto_persist: true,
    no_canon_update: true,
    no_active_engine_update: true,
    checks: {},
    blocking_reasons: [],
    advisory_reasons: [],
    warnings: [],
  };
}

function disabledForeshadowingSettlementDiffPreview(status = "disabled") {
  return {
    used: false,
    phase: "27E",
    version: "foreshadowing_settlement_diff_preview_v1",
    status,
    preview_only: true,
    read_only: true,
    candidate_only: true,
    no_auto_persist: true,
    no_canon_update: true,
    no_active_engine_update: true,
    pending_engine_candidate_created: false,
    settlement_diff_preview: {
      paid_foreshadowing_debts: [],
      kept_open_debts: [],
      blocked_canon_intake_items: [],
      allowed_candidate_settlement_items: [],
    },
    canon_intake_preview: {
      allowed: false,
      direct_canon_write_allowed: false,
      requires_settlement_review: true,
      notes: [],
    },
    warnings: [],
  };
}

function disabledReaderResponseSimulator(status = "disabled") {
  return {
    used: false,
    phase: "29A",
    version: readerResponseSimulatorVersion,
    status,
    read_only: true,
    preview_only: true,
    candidate_only: true,
    no_generation: true,
    no_auto_persist: true,
    no_candidate_save: true,
    no_approval: true,
    no_canon_update: true,
    no_active_engine_update: true,
    warnings: [],
  };
}

async function buildForeshadowingCausalGraphContextLazy(payload, options) {
  const { buildForeshadowingCausalGraphContext } = await import("./foreshadowing-causal-graph-service.mjs");
  return buildForeshadowingCausalGraphContext(payload, options);
}

async function buildForeshadowingPayoffGuardContextLazy(payload, options) {
  const { buildForeshadowingPayoffGuardContext } = await import("./foreshadowing-payoff-guard-service.mjs");
  return buildForeshadowingPayoffGuardContext(payload, options);
}

async function buildForeshadowingPayoffRepairPlannerContextLazy(payload, options) {
  const { buildForeshadowingPayoffRepairPlannerContext } = await import("./foreshadowing-payoff-repair-planner-service.mjs");
  return buildForeshadowingPayoffRepairPlannerContext(payload, options);
}

async function buildForeshadowingPayoffAcceptanceGateContextLazy(payload, options) {
  const { buildForeshadowingPayoffAcceptanceGateContext } = await import("./foreshadowing-payoff-acceptance-gate-service.mjs");
  return buildForeshadowingPayoffAcceptanceGateContext(payload, options);
}

async function buildForeshadowingSettlementDiffPreviewContextLazy(payload, options) {
  const { buildForeshadowingSettlementDiffPreviewContext } = await import("./foreshadowing-settlement-diff-preview-service.mjs");
  return buildForeshadowingSettlementDiffPreviewContext(payload, options);
}

function collectForeshadowingPayoffs(...sources) {
  const payoffs = [];
  for (const source of sources) {
    const value = source?.foreshadowing_payoffs ?? source?.foreshadowingPayoffs ?? source?.detected_payoffs ?? source?.detectedPayoffs;
    if (Array.isArray(value)) payoffs.push(...value);
  }
  return payoffs;
}

function integer(value, fallback, maximum = 8) {
  if (value === undefined || value === null) return fallback;
  if (!Number.isInteger(value) || value < 1 || value > maximum) {
    throw new Error(`max_revision_rounds must be an integer between 1 and ${maximum}.`);
  }
  return value;
}

function normalizeInput(raw = {}) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("input must be an object.");
  }
  const taskPrompt = text(raw.task_prompt ?? raw.taskPrompt);
  if (!taskPrompt) throw new Error("task_prompt is required.");
  if (taskPrompt.length > 12_000) throw new Error("task_prompt exceeds 12000 characters.");
  return {
    taskPrompt,
    generationContext: object(raw.generation_context ?? raw.generationContext),
    retrievalContext: object(raw.retrieval_context ?? raw.retrievalContext),
    sourceBundle: object(raw.source_bundle ?? raw.sourceBundle),
    writingMode: text(raw.writing_mode ?? raw.writingMode) || "next_chapter",
    saveCandidate: raw.save_candidate === true || raw.saveCandidate === true,
    maxRevisionRounds: integer(
      raw.max_revision_rounds ?? raw.maxRevisionRounds,
      2,
    ),
    enableCharacterVoiceGuard:
      raw.enable_character_voice_guard !== false
      && raw.enableCharacterVoiceGuard !== false,
    outputMode: text(raw.output_mode ?? raw.outputMode) || "chat_text",
    includeCharacterMindStateLedger:
      raw.include_character_mind_state_ledger !== false
      && raw.includeCharacterMindStateLedger !== false,
    includeDramaticConflictManager:
      raw.include_dramatic_conflict_manager !== false
      && raw.includeDramaticConflictManager !== false,
    includeForeshadowingCausalGraph:
      raw.include_foreshadowing_causal_graph === true
      || raw.includeForeshadowingCausalGraph === true,
    includeForeshadowingPayoffGuard:
      raw.include_foreshadowing_payoff_guard === true
      || raw.includeForeshadowingPayoffGuard === true,
    includeForeshadowingPayoffRepairPlanner:
      raw.include_foreshadowing_payoff_repair_planner === true
      || raw.includeForeshadowingPayoffRepairPlanner === true,
    includeForeshadowingPayoffAcceptanceGate:
      raw.include_foreshadowing_payoff_acceptance_gate === true
      || raw.includeForeshadowingPayoffAcceptanceGate === true,
    includeForeshadowingSettlementDiffPreview:
      raw.include_foreshadowing_settlement_diff_preview === true
      || raw.includeForeshadowingSettlementDiffPreview === true,
    includeReaderResponseRevisionGate:
      raw.include_reader_response_revision_gate === true
      || raw.includeReaderResponseRevisionGate === true,
    characterNames: arrayOfText(
      raw.character_names ?? raw.characterNames ?? raw.characters,
      24,
    ),
  };
}

function existingContextResult(sourceBundle, options) {
  if (options.existingContextResult) return options.existingContextResult;
  if (!sourceBundle.bundle_id) return null;
  return {
    bundle: sourceBundle,
    context_bundle_path: text(sourceBundle.context_bundle_path),
    context_for_chat_path: text(sourceBundle.context_for_chat_path),
  };
}

async function callAdapter(adapter, payload) {
  const result = await adapter(payload);
  if (typeof result === "string") return { text: result.trim(), warnings: [] };
  return {
    ...object(result),
    text: text(result?.text ?? result?.revised_text ?? result?.polished_text),
    warnings: Array.isArray(result?.warnings) ? result.warnings : [],
  };
}

async function runPolisher(draftText, writingCardDirector, input, options, characterMindStateLedger = null, dramaticConflictManager = null, foreshadowingCausalGraph = null, foreshadowingPayoffGuard = null, foreshadowingPayoffRepairPlanner = null, foreshadowingPayoffAcceptanceGate = null, foreshadowingSettlementDiffPreview = null) {
  if (typeof options.finalPolisherAdapter === "function") {
    const adapted = await options.finalPolisherAdapter({
      raw_draft_text: draftText,
      writing_card_director_context: writingCardDirector,
      generation_context: input.generationContext,
      retrieval_context: input.retrievalContext,
      character_mind_state_ledger: characterMindStateLedger,
      dramatic_conflict_manager: dramaticConflictManager,
      foreshadowing_causal_graph: foreshadowingCausalGraph,
      foreshadowing_payoff_guard: foreshadowingPayoffGuard,
      foreshadowing_payoff_repair_planner: foreshadowingPayoffRepairPlanner,
      foreshadowing_payoff_acceptance_gate: foreshadowingPayoffAcceptanceGate,
      foreshadowing_settlement_diff_preview: foreshadowingSettlementDiffPreview,
    });
    return {
      status: adapted?.status ?? "completed",
      polished_text: text(adapted?.polished_text ?? adapted?.text ?? draftText),
      revision_report: adapted?.revision_report ?? null,
      needs_structural_revision: adapted?.needs_structural_revision === true,
      suggested_return_stage: adapted?.suggested_return_stage ?? null,
      warnings: Array.isArray(adapted?.warnings) ? adapted.warnings : [],
      foreshadowing_payoffs: Array.isArray(adapted?.foreshadowing_payoffs) ? adapted.foreshadowing_payoffs : [],
    };
  }
  return runFinalPolisherEditorialBrain({
    raw_draft_text: draftText,
    writing_card_director_context: writingCardDirector,
    generation_context: input.generationContext,
    retrieval_context: input.retrievalContext,
    character_mind_state_ledger: characterMindStateLedger,
    dramatic_conflict_manager: dramaticConflictManager,
    foreshadowing_causal_graph: foreshadowingCausalGraph,
      foreshadowing_payoff_guard: foreshadowingPayoffGuard,
      foreshadowing_payoff_repair_planner: foreshadowingPayoffRepairPlanner,
      foreshadowing_payoff_acceptance_gate: foreshadowingPayoffAcceptanceGate,
      foreshadowing_settlement_diff_preview: foreshadowingSettlementDiffPreview,
  }, {
    editorialAdapter: options.finalPolisherEditorialAdapter,
  });
}

function buildCritique(polisher) {
  const report = object(polisher.revision_report);
  const structural = object(report.structural_gate);
  const risks = Array.isArray(report.risk_flags) ? report.risk_flags : [];
  const reasons = Array.isArray(structural.reasons) ? structural.reasons : [];
  return {
    structural_reasons: reasons,
    risk_flags: risks,
    suggested_return_stage:
      polisher.suggested_return_stage ?? structural.suggested_return_stage ?? null,
    missing_scene_function: reasons.includes("missing_scene_function"),
    weak_ending_hook:
      reasons.includes("missing_ending_event_hook")
      || reasons.includes("ending_hook_is_pretty_sentence_only"),
    pretty_but_empty_ending: risks.includes("pretty_but_empty_ending"),
    over_explained_subtext: risks.includes("subtext_over_explained"),
    missing_concrete_action_or_cost:
      reasons.includes("battle_payment_insufficient")
      || risks.includes("scene_lacks_concrete_objects"),
  };
}

function buildRevisionPlan(critique, recursiveRevisionPolicy = null) {
  return {
    preserve_canon_facts: true,
    preserve_character_state: true,
    preserve_timeline: true,
    preserve_battle_result: true,
    preserve_candidate_only_scope: true,
    fix_structural_reasons: critique.structural_reasons,
    strengthen_scene_function: critique.missing_scene_function,
    add_concrete_action_or_cost: critique.missing_concrete_action_or_cost,
    strengthen_ending_event_hook: critique.weak_ending_hook || critique.pretty_but_empty_ending,
    keep_dialogue_natural: true,
    avoid_administrative_prose: true,
    recursive_revision_policy: recursiveRevisionPolicy,
    revision_type: recursiveRevisionPolicy?.revision_type ?? null,
    return_stage: recursiveRevisionPolicy?.return_stage ?? critique.suggested_return_stage ?? null,
    rewrite_targets: recursiveRevisionPolicy?.rewrite_targets ?? [],
    preserve_constraints: recursiveRevisionPolicy?.preserve_constraints ?? [],
    stop_conditions: recursiveRevisionPolicy?.stop_conditions ?? [],
    escalation_reason: recursiveRevisionPolicy?.escalation_reason ?? null,
  };
}

function baseResult(input, now) {
  return {
    status: "failed",
    pipeline_stage: "initializing",
    stop_reason: null,
    final_candidate_text: "",
    final_candidate_hash: "",
    final_candidate_source: null,
    output_mode: input.outputMode,
    save_candidate_requested: input.saveCandidate,
    candidate_created: false,
    candidate_id: null,
    canon_status: "candidate_only",
    adopted: false,
    settled: false,
    active_engine_update_allowed: false,
    canon_update_allowed: false,
    direct_adoption_allowed: false,
    adoption_requires_approval_queue: false,
    final_text_can_be_displayed: false,
    can_output_to_chat: false,
    backend_generation_provider_used: false,
    backend_generation_provider_type: null,
    backend_generation_provider_id: null,
    backend_generation_provider_status: "not_resolved",
    backend_revision_provider_used: false,
    backend_revision_provider_type: null,
    provider_trace_ids: [],
    generation_provider: null,
    generation_provider_required: false,
    revision_provider_required: false,
    generation: {
      adapter_used: false,
      raw_draft_hash: "",
      raw_draft_chars: 0,
      status: "not_started",
      warnings: [],
    },
    recursive_revision: {
      used: false,
      status: "failed",
      rounds_attempted: 0,
      max_revision_rounds: input.maxRevisionRounds,
      stop_reason: null,
      rounds: [],
    },
    final_polisher: {
      status: "not_started",
      needs_structural_revision: false,
      suggested_return_stage: null,
      warnings: [],
    },
    character_voice_guard: {
      used: false,
      verdict: null,
      severity: null,
      blocking: false,
      display: formatCharacterVoiceGuardForDisplay(null),
    },
    character_mind_state_ledger: {
      used: false,
      phase: "25A",
      version: "character_mind_state_ledger_v1",
      status: "not_started",
      read_only: true,
      candidate_only: true,
      no_auto_persist: true,
      no_canon_update: true,
      no_active_engine_update: true,
      characters: [],
      warnings: [],
    },
    dramatic_conflict_manager: {
      used: false,
      phase: "26A",
      version: "dramatic_conflict_manager_v1",
      status: "not_started",
      read_only: true,
      candidate_only: true,
      no_auto_persist: true,
      no_canon_update: true,
      no_active_engine_update: true,
      plan: null,
      warnings: [],
    },
    foreshadowing_causal_graph: {
      used: false,
      phase: "27A",
      version: "foreshadowing_causal_graph_v1",
      status: "not_started",
      read_only: true,
      candidate_only: true,
      no_auto_persist: true,
      no_canon_update: true,
      no_active_engine_update: true,
      graph: null,
      warnings: [],
    },    foreshadowing_payoff_guard: disabledForeshadowingPayoffGuard("not_started"),

    foreshadowing_payoff_repair_planner: disabledForeshadowingPayoffRepairPlanner("not_started"),

    foreshadowing_payoff_acceptance_gate: disabledForeshadowingPayoffAcceptanceGate("not_started"),

    foreshadowing_settlement_diff_preview: disabledForeshadowingSettlementDiffPreview("not_started"),

    reader_response_simulator: disabledReaderResponseSimulator("not_started"),
    reader_response_revision_gate: disabledReaderResponseRevisionGate("not_started"),
    full_pipeline_acceptance_evidence_packet: disabledFullPipelineAcceptanceEvidencePacket("not_started"),

    report: {
      pipeline_name: "full_recursive_writing_pipeline",
      phase: "24B",
      built_at: now.toISOString(),
      context_hash: "",
      retrieval_hash: sha256(JSON.stringify(input.retrievalContext)),
      trace_ids: [],
      warnings: [],
    },
  };
}

export async function runFullRecursiveWritingPipeline(rawInput = {}, options = {}) {
  const input = normalizeInput(rawInput);
  const now = typeof options.now === "function"
    ? options.now()
    : options.now instanceof Date ? options.now : new Date();
  const result = baseResult(input, now);
  const refreshFullPipelineAcceptanceEvidencePacket = (status = "generated") => {
    result.full_pipeline_acceptance_evidence_packet = buildFullPipelineAcceptanceEvidencePacket(result, {
      status,
      built_at: now.toISOString(),
    });
    return result.full_pipeline_acceptance_evidence_packet;
  };
  const provider = resolveBackendGenerationProvider(rawInput, options);
  let generationAdapter = options.generationAdapter;
  let revisionAdapter = options.revisionAdapter;
  if (typeof generationAdapter !== "function" && provider.generation_available) {
    generationAdapter = buildGenerationAdapterFromProvider(provider, options.providerCallOptions);
    result.backend_generation_provider_used = true;
  }
  result.backend_generation_provider_type = provider.provider_type;
  result.backend_generation_provider_id = provider.provider_id;
  result.backend_generation_provider_status = provider.status;
  result.generation_provider = {
    available: provider.available,
    provider_type: provider.provider_type,
    provider_id: provider.provider_id,
    status: provider.status,
    model_name: provider.model_name,
    model_version: provider.model_version,
    endpoint_url_present: provider.endpoint_url_present,
    token_env_name: provider.token_env_name,
    token_present: provider.token_present,
  };
  if (typeof generationAdapter !== "function") {
    result.pipeline_stage = "generation_provider_required";
    result.stop_reason = provider.status;
    result.generation.status = provider.status;
    result.recursive_revision.stop_reason = provider.status;
    result.generation_provider_required = true;
    result.report.warnings.push(...provider.warnings, provider.status);
    return result;
  }

  const orchestration = await buildFullNeuralWritingOrchestration({
    task_prompt: input.taskPrompt,
    generation_context: input.generationContext,
    retrieval_context: input.retrievalContext,
    chapter_mode: input.writingMode,
    output_mode: "candidate_save_later",
  }, {
    ...options,
    existingContextResult: existingContextResult(input.sourceBundle, options),
  });
  const bundle = options.existingContextResult?.bundle
    ?? (input.sourceBundle.bundle_id ? input.sourceBundle : null);
  const writingContext = bundle ?? {
    bundle_id: orchestration.pre_generation.bundle_id,
    context_bundle_path: orchestration.pre_generation.context_bundle_path,
    context_for_chat_path: orchestration.pre_generation.context_for_chat_path,
  };
  const writingCardDirector = options.existingContextResult?.bundle?.content
    ?.writing_card_director_context
    ?? input.sourceBundle.content?.writing_card_director_context
    ?? null;
  result.report.context_hash = sha256(JSON.stringify(writingContext));
  result.report.trace_ids = [
    orchestration.pre_generation.bundle_id,
    ...(orchestration.orchestration_report.neural_modules_used ?? []),
  ].filter(Boolean);

  const characterMindStateLedger = input.includeCharacterMindStateLedger
    ? await buildCharacterMindStateLedgerContext({
      task_prompt: input.taskPrompt,
      generation_context: input.generationContext,
      retrieval_context: input.retrievalContext,
      source_bundle: bundle ?? input.sourceBundle,
      writing_context: writingContext,
      character_names: input.characterNames,
    }, options)
    : {
      used: false,
      phase: "25A",
      version: "character_mind_state_ledger_v1",
      status: "disabled",
      read_only: true,
      candidate_only: true,
      no_auto_persist: true,
      no_canon_update: true,
      no_active_engine_update: true,
      characters: [],
      warnings: [],
    };

  result.character_mind_state_ledger = {
    ...characterMindStateLedger,
    characters: characterMindStateLedger.characters ?? [],
    warnings: characterMindStateLedger.warnings ?? [],
  };

  if (characterMindStateLedger.trace_id) {
    result.report.trace_ids.push(characterMindStateLedger.trace_id);
  }

  result.report.character_mind_state_ledger_used = characterMindStateLedger.used === true;
  result.report.character_mind_state_ledger_status = characterMindStateLedger.status ?? null;
  result.report.character_mind_state_ledger_candidate_only = characterMindStateLedger.candidate_only !== false;
  result.report.character_mind_state_ledger_no_auto_persist = characterMindStateLedger.no_auto_persist !== false;

  const dramaticConflictManager = input.includeDramaticConflictManager
    ? await buildDramaticConflictManagerContext({
      task_prompt: input.taskPrompt,
      generation_context: input.generationContext,
      retrieval_context: input.retrievalContext,
      source_bundle: bundle ?? input.sourceBundle,
      writing_context: writingContext,
      character_names: input.characterNames,
      character_mind_state_ledger: characterMindStateLedger,
    }, options)
    : {
      used: false,
      phase: "26A",
      version: "dramatic_conflict_manager_v1",
      status: "disabled",
      read_only: true,
      candidate_only: true,
      no_auto_persist: true,
      no_canon_update: true,
      no_active_engine_update: true,
      plan: null,
      warnings: [],
    };

  result.dramatic_conflict_manager = {
    ...dramaticConflictManager,
    warnings: dramaticConflictManager.warnings ?? [],
  };

  if (dramaticConflictManager.trace_id) {
    result.report.trace_ids.push(dramaticConflictManager.trace_id);
  }

  result.report.dramatic_conflict_manager_used = dramaticConflictManager.used === true;
  result.report.dramatic_conflict_manager_status = dramaticConflictManager.status ?? null;
  result.report.dramatic_conflict_manager_candidate_only = dramaticConflictManager.candidate_only !== false;
  result.report.dramatic_conflict_manager_no_auto_persist = dramaticConflictManager.no_auto_persist !== false;
  result.report.one_chapter_one_change_contract = dramaticConflictManager.one_chapter_one_change_contract ?? null;

  const foreshadowingCausalGraph = shouldUseForeshadowingCausalGraph(rawInput, input, options)
    ? await buildForeshadowingCausalGraphContextLazy({
      task_prompt: input.taskPrompt,
      generation_context: input.generationContext,
      retrieval_context: input.retrievalContext,
      source_bundle: bundle ?? input.sourceBundle,
      writing_context: writingContext,
      character_names: input.characterNames,
      character_mind_state_ledger: characterMindStateLedger,
      dramatic_conflict_manager: dramaticConflictManager,
    }, options)
    : {
      used: false,
      phase: "27A",
      version: "foreshadowing_causal_graph_v1",
      status: "disabled",
      read_only: true,
      candidate_only: true,
      no_auto_persist: true,
      no_canon_update: true,
      no_active_engine_update: true,
      graph: null,
      warnings: [],
    };

  result.foreshadowing_causal_graph = {
    ...foreshadowingCausalGraph,
    warnings: foreshadowingCausalGraph.warnings ?? [],
  };

  if (foreshadowingCausalGraph.trace_id) {
    result.report.trace_ids.push(foreshadowingCausalGraph.trace_id);
  }

  result.report.foreshadowing_causal_graph_used = foreshadowingCausalGraph.used === true;
  result.report.foreshadowing_causal_graph_status = foreshadowingCausalGraph.status ?? null;
  result.report.foreshadowing_causal_graph_candidate_only = foreshadowingCausalGraph.candidate_only !== false;
  result.report.foreshadowing_causal_graph_no_auto_persist = foreshadowingCausalGraph.no_auto_persist !== false;
  result.report.foreshadowing_provider_guidance = foreshadowingCausalGraph.provider_guidance ?? null;

  let foreshadowingPayoffGuard = disabledForeshadowingPayoffGuard();
  result.foreshadowing_payoff_guard = foreshadowingPayoffGuard;
  const refreshForeshadowingPayoffGuard = async (candidateTextValue, payoffs = []) => {
    if (!shouldUseForeshadowingPayoffGuard(rawInput, input, options)) {
      foreshadowingPayoffGuard = disabledForeshadowingPayoffGuard();
    } else {
      const optionConfig = phase27bObject(options.foreshadowingPayoffGuard ?? options.foreshadowing_payoff_guard);
      foreshadowingPayoffGuard = await buildForeshadowingPayoffGuardContextLazy({
        task_prompt: input.taskPrompt,
        generation_context: input.generationContext,
        retrieval_context: input.retrievalContext,
        candidate_text: candidateTextValue,
        foreshadowing_causal_graph: optionConfig.foreshadowing_causal_graph
          ?? optionConfig.foreshadowingCausalGraph
          ?? foreshadowingCausalGraph,
        foreshadowing_payoffs: payoffs,
        include_foreshadowing_payoff_guard: true,
      }, {
        ...options,
        foreshadowingPayoffGuard: {
          ...optionConfig,
          foreshadowing_causal_graph: optionConfig.foreshadowing_causal_graph
            ?? optionConfig.foreshadowingCausalGraph
            ?? foreshadowingCausalGraph,
          payoffs,
        },
      });
    }
    result.foreshadowing_payoff_guard = {
      ...foreshadowingPayoffGuard,
      warnings: foreshadowingPayoffGuard.warnings ?? [],
    };
    if (foreshadowingPayoffGuard.trace_id && !result.report.trace_ids.includes(foreshadowingPayoffGuard.trace_id)) {
      result.report.trace_ids.push(foreshadowingPayoffGuard.trace_id);
    }
    result.report.foreshadowing_payoff_guard_used = foreshadowingPayoffGuard.used === true;
    result.report.foreshadowing_payoff_guard_status = foreshadowingPayoffGuard.status ?? null;
    result.report.foreshadowing_payoff_guard_candidate_only = foreshadowingPayoffGuard.candidate_only !== false;
    result.report.foreshadowing_payoff_guard_no_auto_persist = foreshadowingPayoffGuard.no_auto_persist !== false;
    result.report.foreshadowing_payoff_guard_blocking = foreshadowingPayoffGuard.blocking === true;
    result.report.foreshadowing_payoff_provider_guidance = foreshadowingPayoffGuard.provider_guidance ?? null;
    return foreshadowingPayoffGuard;
  };

  let foreshadowingPayoffRepairPlanner = disabledForeshadowingPayoffRepairPlanner();
  result.foreshadowing_payoff_repair_planner = foreshadowingPayoffRepairPlanner;
  const refreshForeshadowingPayoffRepairPlanner = async (candidateTextValue) => {
    if (!shouldUseForeshadowingPayoffRepairPlanner(rawInput, input, options)) {
      foreshadowingPayoffRepairPlanner = disabledForeshadowingPayoffRepairPlanner();
    } else {
      const optionConfig = phase27cObject(options.foreshadowingPayoffRepairPlanner ?? options.foreshadowing_payoff_repair_planner);
      foreshadowingPayoffRepairPlanner = await buildForeshadowingPayoffRepairPlannerContextLazy({
        task_prompt: input.taskPrompt,
        generation_context: input.generationContext,
        retrieval_context: input.retrievalContext,
        candidate_text: candidateTextValue,
        foreshadowing_payoff_guard: foreshadowingPayoffGuard,
        include_foreshadowing_payoff_repair_planner: true,
      }, {
        ...options,
        foreshadowingPayoffRepairPlanner: {
          ...optionConfig,
          foreshadowing_payoff_guard: foreshadowingPayoffGuard,
        },
      });
    }
    result.foreshadowing_payoff_repair_planner = {
      ...foreshadowingPayoffRepairPlanner,
      warnings: foreshadowingPayoffRepairPlanner.warnings ?? [],
    };
    if (foreshadowingPayoffRepairPlanner.trace_id && !result.report.trace_ids.includes(foreshadowingPayoffRepairPlanner.trace_id)) {
      result.report.trace_ids.push(foreshadowingPayoffRepairPlanner.trace_id);
    }
    result.report.foreshadowing_payoff_repair_planner_used = foreshadowingPayoffRepairPlanner.used === true;
    result.report.foreshadowing_payoff_repair_planner_status = foreshadowingPayoffRepairPlanner.status ?? null;
    result.report.foreshadowing_payoff_repair_planner_candidate_only = foreshadowingPayoffRepairPlanner.candidate_only !== false;
    result.report.foreshadowing_payoff_repair_planner_no_auto_persist = foreshadowingPayoffRepairPlanner.no_auto_persist !== false;
    result.report.foreshadowing_payoff_repair_planner_revision_required = foreshadowingPayoffRepairPlanner.revision_required === true;
    result.report.foreshadowing_payoff_repair_provider_guidance = foreshadowingPayoffRepairPlanner.provider_guidance ?? null;
    return foreshadowingPayoffRepairPlanner;
  };

  const applyForeshadowingPayoffRepairGate = (polisherResult) => {
    if (foreshadowingPayoffRepairPlanner.revision_required !== true) return polisherResult;
    return {
      ...polisherResult,
      needs_structural_revision: true,
      suggested_return_stage:
        foreshadowingPayoffRepairPlanner.revision_plan_patch?.suggested_return_stage
        ?? polisherResult.suggested_return_stage
        ?? "foreshadowing_payoff_repair",
      warnings: [
        ...(polisherResult.warnings ?? []),
        "foreshadowing_payoff_repair_revision_required",
      ],
    };
  };

  let foreshadowingPayoffAcceptanceGate = disabledForeshadowingPayoffAcceptanceGate();
  result.foreshadowing_payoff_acceptance_gate = foreshadowingPayoffAcceptanceGate;
  const refreshForeshadowingPayoffAcceptanceGate = async () => {
    if (!shouldUseForeshadowingPayoffAcceptanceGate(rawInput, input, options)) {
      foreshadowingPayoffAcceptanceGate = disabledForeshadowingPayoffAcceptanceGate();
    } else {
      const optionConfig = phase27dObject(options.foreshadowingPayoffAcceptanceGate ?? options.foreshadowing_payoff_acceptance_gate);
      foreshadowingPayoffAcceptanceGate = await buildForeshadowingPayoffAcceptanceGateContextLazy({
        task_prompt: input.taskPrompt,
        generation_context: input.generationContext,
        retrieval_context: input.retrievalContext,
        candidate_text: result.final_candidate_text || "",
        foreshadowing_causal_graph: foreshadowingCausalGraph,
        foreshadowing_payoff_guard: foreshadowingPayoffGuard,
        foreshadowing_payoff_repair_planner: foreshadowingPayoffRepairPlanner,
        include_foreshadowing_payoff_acceptance_gate: true,
      }, {
        ...options,
        foreshadowingPayoffAcceptanceGate: {
          ...optionConfig,
          foreshadowing_causal_graph: foreshadowingCausalGraph,
          foreshadowing_payoff_guard: foreshadowingPayoffGuard,
          foreshadowing_payoff_repair_planner: foreshadowingPayoffRepairPlanner,
        },
      });
    }
    result.foreshadowing_payoff_acceptance_gate = {
      ...foreshadowingPayoffAcceptanceGate,
      warnings: foreshadowingPayoffAcceptanceGate.warnings ?? [],
    };
    if (foreshadowingPayoffAcceptanceGate.trace_id && !result.report.trace_ids.includes(foreshadowingPayoffAcceptanceGate.trace_id)) {
      result.report.trace_ids.push(foreshadowingPayoffAcceptanceGate.trace_id);
    }
    result.report.foreshadowing_payoff_acceptance_gate_used = foreshadowingPayoffAcceptanceGate.used === true;
    result.report.foreshadowing_payoff_acceptance_gate_status = foreshadowingPayoffAcceptanceGate.status ?? null;
    result.report.foreshadowing_payoff_acceptance_ready = foreshadowingPayoffAcceptanceGate.can_enter_adoption_review === true;
    result.report.foreshadowing_payoff_acceptance_candidate_only = foreshadowingPayoffAcceptanceGate.candidate_only !== false;
    result.report.foreshadowing_payoff_acceptance_no_auto_persist = foreshadowingPayoffAcceptanceGate.no_auto_persist !== false;
    result.report.foreshadowing_payoff_acceptance_blocking_reasons = foreshadowingPayoffAcceptanceGate.blocking_reasons ?? [];
    result.report.foreshadowing_payoff_acceptance_advisory_reasons = foreshadowingPayoffAcceptanceGate.advisory_reasons ?? [];
    return foreshadowingPayoffAcceptanceGate;
  };

  let foreshadowingSettlementDiffPreview = disabledForeshadowingSettlementDiffPreview();
  result.foreshadowing_settlement_diff_preview = foreshadowingSettlementDiffPreview;
  const refreshForeshadowingSettlementDiffPreview = async () => {
    if (!shouldUseForeshadowingSettlementDiffPreview(rawInput, input, options)) {
      foreshadowingSettlementDiffPreview = disabledForeshadowingSettlementDiffPreview();
    } else {
      const optionConfig = phase27eObject(options.foreshadowingSettlementDiffPreview ?? options.foreshadowing_settlement_diff_preview);
      foreshadowingSettlementDiffPreview = await buildForeshadowingSettlementDiffPreviewContextLazy({
        task_prompt: input.taskPrompt,
        generation_context: input.generationContext,
        retrieval_context: input.retrievalContext,
        candidate_text: result.final_candidate_text || "",
        foreshadowing_causal_graph: foreshadowingCausalGraph,
        foreshadowing_payoff_guard: foreshadowingPayoffGuard,
        foreshadowing_payoff_repair_planner: foreshadowingPayoffRepairPlanner,
        foreshadowing_payoff_acceptance_gate: foreshadowingPayoffAcceptanceGate,
        include_foreshadowing_settlement_diff_preview: true,
      }, {
        ...options,
        foreshadowingSettlementDiffPreview: {
          ...optionConfig,
          foreshadowing_causal_graph: foreshadowingCausalGraph,
          foreshadowing_payoff_guard: foreshadowingPayoffGuard,
          foreshadowing_payoff_repair_planner: foreshadowingPayoffRepairPlanner,
          foreshadowing_payoff_acceptance_gate: foreshadowingPayoffAcceptanceGate,
        },
      });
    }
    result.foreshadowing_settlement_diff_preview = {
      ...foreshadowingSettlementDiffPreview,
      warnings: foreshadowingSettlementDiffPreview.warnings ?? [],
    };
    if (foreshadowingSettlementDiffPreview.trace_id && !result.report.trace_ids.includes(foreshadowingSettlementDiffPreview.trace_id)) {
      result.report.trace_ids.push(foreshadowingSettlementDiffPreview.trace_id);
    }
    result.report.foreshadowing_settlement_diff_preview_used = foreshadowingSettlementDiffPreview.used === true;
    result.report.foreshadowing_settlement_diff_preview_status = foreshadowingSettlementDiffPreview.status ?? null;
    result.report.foreshadowing_settlement_diff_preview_candidate_only = foreshadowingSettlementDiffPreview.candidate_only !== false;
    result.report.foreshadowing_settlement_diff_preview_no_auto_persist = foreshadowingSettlementDiffPreview.no_auto_persist !== false;
    result.report.foreshadowing_settlement_diff_preview_no_canon_update = foreshadowingSettlementDiffPreview.no_canon_update !== false;
    result.report.foreshadowing_settlement_diff_preview_paid_count = foreshadowingSettlementDiffPreview.settlement_diff_preview?.paid_foreshadowing_debts?.length ?? 0;
    result.report.foreshadowing_settlement_diff_preview_blocked_count = foreshadowingSettlementDiffPreview.settlement_diff_preview?.blocked_canon_intake_items?.length ?? 0;
    return foreshadowingSettlementDiffPreview;
  };

  let readerResponseSimulator = disabledReaderResponseSimulator();
  let readerResponseRevisionGate = disabledReaderResponseRevisionGate();
  result.reader_response_simulator = readerResponseSimulator;
  result.reader_response_revision_gate = readerResponseRevisionGate;

  const refreshReaderResponseRevisionGate = async (candidateTextValue) => {
    if (!shouldUseReaderResponseRevisionGate(rawInput, input, options)) {
      readerResponseSimulator = disabledReaderResponseSimulator();
      readerResponseRevisionGate = disabledReaderResponseRevisionGate();
    } else {
      const optionConfig = object(options.readerResponseRevisionGate ?? options.reader_response_revision_gate);
      const conflictPlan = optionConfig.dramatic_conflict_plan
        ?? optionConfig.dramaticConflictPlan
        ?? rawInput.dramatic_conflict_plan
        ?? rawInput.dramaticConflictPlan
        ?? dramaticConflictManager.plan
        ?? dramaticConflictManager;

      readerResponseSimulator = await buildReaderResponseSimulatorReport({
        task_prompt: input.taskPrompt,
        generation_context: input.generationContext,
        retrieval_context: input.retrievalContext,
        candidate_text: candidateTextValue,
        dramatic_conflict_plan: conflictPlan,
        dramatic_conflict_manager: dramaticConflictManager.used === true ? dramaticConflictManager : null,
        reader_questions_to_carry_forward:
          optionConfig.reader_questions_to_carry_forward
          ?? optionConfig.readerQuestionsToCarryForward
          ?? rawInput.reader_questions_to_carry_forward
          ?? rawInput.readerQuestionsToCarryForward,
      }, {
        ...options,
        dramaticConflictManager: dramaticConflictManager.used === true ? dramaticConflictManager : null,
        candidateText: candidateTextValue,
      });

      readerResponseRevisionGate = buildReaderResponseRevisionGate({
        task_prompt: input.taskPrompt,
        candidate_text: candidateTextValue,
        reader_response_simulator: readerResponseSimulator,
      }, options);
    }

    result.reader_response_simulator = readerResponseSimulator;
    result.reader_response_revision_gate = readerResponseRevisionGate;

    if (readerResponseRevisionGate.trace_id && !result.report.trace_ids.includes(readerResponseRevisionGate.trace_id)) {
      result.report.trace_ids.push(readerResponseRevisionGate.trace_id);
    }

    result.report.reader_response_simulator_used = readerResponseSimulator.used === true;
    result.report.reader_response_simulator_status = readerResponseSimulator.status ?? null;
    result.report.reader_response_revision_gate_used = readerResponseRevisionGate.used === true;
    result.report.reader_response_revision_gate_status = readerResponseRevisionGate.status ?? null;
    result.report.reader_response_revision_gate_revision_required = readerResponseRevisionGate.revision_required === true;
    result.report.reader_response_revision_gate_revision_type = readerResponseRevisionGate.revision_type ?? null;
    result.report.reader_response_revision_gate_return_stage = readerResponseRevisionGate.return_stage ?? null;
    result.report.reader_response_revision_gate_candidate_only = readerResponseRevisionGate.candidate_only !== false;
    result.report.reader_response_revision_gate_no_auto_persist = readerResponseRevisionGate.no_auto_persist !== false;
    result.report.reader_response_revision_gate_no_canon_update = readerResponseRevisionGate.no_canon_update !== false;
    result.report.reader_response_revision_gate_no_active_engine_update = readerResponseRevisionGate.no_active_engine_update !== false;

    return readerResponseRevisionGate;
  };

  const applyReaderResponseRevisionGate = (polisherResult) => {
    if (readerResponseRevisionGate.revision_required !== true) return polisherResult;
    return {
      ...polisherResult,
      needs_structural_revision: true,
      suggested_return_stage:
        readerResponseRevisionGate.return_stage
        ?? polisherResult.suggested_return_stage
        ?? "raw_generation",
      warnings: [
        ...(polisherResult.warnings ?? []),
        "reader_response_revision_required",
      ],
    };
  };

  let generated;
  try {
    generated = await callAdapter(generationAdapter, {
      task_prompt: input.taskPrompt,
      generation_context: input.generationContext,
      retrieval_context: input.retrievalContext,
      writing_context: writingContext,
      neural_pre_generation_report: orchestration.pre_generation,
      writing_card_director: writingCardDirector,
      character_mind_state_ledger: characterMindStateLedger,
      dramatic_conflict_manager: dramaticConflictManager,
      foreshadowing_causal_graph: foreshadowingCausalGraph,
      foreshadowing_payoff_guard: foreshadowingPayoffGuard,
      foreshadowing_payoff_repair_planner: foreshadowingPayoffRepairPlanner,
      foreshadowing_payoff_acceptance_gate: foreshadowingPayoffAcceptanceGate,
      foreshadowing_settlement_diff_preview: foreshadowingSettlementDiffPreview,
    });
  } catch (error) {
    result.pipeline_stage = "generation_failed";
    result.stop_reason = error?.provider_status ?? "provider_http_error";
    result.generation.status = result.stop_reason;
    result.recursive_revision.stop_reason = result.stop_reason;
    result.report.warnings.push(result.stop_reason);
    return result;
  }
  if (generated.provider_trace_id) {
    result.provider_trace_ids.push(generated.provider_trace_id);
  }
  result.generation = {
    adapter_used: true,
    adapter_name: generated.adapter_name ?? generationAdapter.name ?? "generation_adapter",
    model_name: generated.model_name ?? null,
    model_version: generated.model_version ?? null,
    raw_draft_hash: generated.text ? sha256(generated.text) : "",
    raw_draft_chars: generated.text.length,
    status: generated.text ? "completed" : "failed",
    warnings: generated.warnings,
  };
  if (!generated.text) {
    result.pipeline_stage = "generation_failed";
    result.stop_reason = "generation_adapter_returned_empty_text";
    result.recursive_revision.stop_reason = result.stop_reason;
    result.report.warnings.push(...generated.warnings, result.stop_reason);
    return result;
  }

  let draft = generated.text;
  let providerForeshadowingPayoffs = collectForeshadowingPayoffs(generated);
  foreshadowingPayoffGuard = await refreshForeshadowingPayoffGuard(draft, providerForeshadowingPayoffs);
  foreshadowingPayoffRepairPlanner = await refreshForeshadowingPayoffRepairPlanner(draft);
  let polisher = await runPolisher(draft, writingCardDirector, input, options, characterMindStateLedger, dramaticConflictManager, foreshadowingCausalGraph, foreshadowingPayoffGuard, foreshadowingPayoffRepairPlanner, foreshadowingPayoffAcceptanceGate, foreshadowingSettlementDiffPreview);
  polisher = applyForeshadowingPayoffRepairGate(polisher);
  providerForeshadowingPayoffs = collectForeshadowingPayoffs(generated, polisher);
  foreshadowingPayoffGuard = await refreshForeshadowingPayoffGuard(draft, providerForeshadowingPayoffs);
  foreshadowingPayoffRepairPlanner = await refreshForeshadowingPayoffRepairPlanner(draft);
  polisher = applyForeshadowingPayoffRepairGate(polisher);
  readerResponseRevisionGate = await refreshReaderResponseRevisionGate(polisher.polished_text || draft);
  polisher = applyReaderResponseRevisionGate(polisher);
  let finalSource = "backend_generation";
  result.final_polisher = {
    status: polisher.status,
    needs_structural_revision: polisher.needs_structural_revision === true,
    suggested_return_stage: polisher.suggested_return_stage ?? null,
    warnings: polisher.warnings ?? [],
  };

  if (polisher.needs_structural_revision === true) {
    result.recursive_revision.used = true;
    if (typeof revisionAdapter !== "function" && provider.revision_available) {
      revisionAdapter = buildRevisionAdapterFromProvider(provider, options.providerCallOptions);
      result.backend_revision_provider_used = true;
      result.backend_revision_provider_type = provider.provider_type;
    }
    if (typeof revisionAdapter !== "function") {
      result.pipeline_stage = "structural_revision_required";
      result.stop_reason = "revision_provider_required";
      result.revision_provider_required = true;
      result.recursive_revision.stop_reason = result.stop_reason;
      result.report.warnings.push(result.stop_reason);
      return result;
    }
    for (let round = 1; round <= input.maxRevisionRounds; round += 1) {
      const critique = buildCritique(polisher);
      const recursiveRevisionPolicy = buildRecursiveRevisionPolicy({
        critique,
        round,
        max_revision_rounds: input.maxRevisionRounds,
        suggested_return_stage: polisher.suggested_return_stage,
        polisher,
        foreshadowing_payoff_repair_planner: foreshadowingPayoffRepairPlanner,
        reader_response_revision_gate: readerResponseRevisionGate,
      });
      const revisionPlan = buildRevisionPlan(critique, recursiveRevisionPolicy);
      let revised;
      try {
        revised = await callAdapter(revisionAdapter, {
          round,
          task_prompt: input.taskPrompt,
          generation_context: input.generationContext,
          retrieval_context: input.retrievalContext,
          draft_text: draft,
          critique,
          recursive_revision_policy: recursiveRevisionPolicy,
          reader_response_simulator: readerResponseSimulator,
          reader_response_revision_gate: readerResponseRevisionGate,
          revision_plan: {
            ...revisionPlan,
            reader_response_revision_gate: readerResponseRevisionGate,
            foreshadowing_payoff_repair: foreshadowingPayoffRepairPlanner.revision_plan_patch,
          },
          writing_context: writingContext,
          neural_pre_generation_report: orchestration.pre_generation,
          writing_card_director: writingCardDirector,
          character_mind_state_ledger: characterMindStateLedger,
          dramatic_conflict_manager: dramaticConflictManager.used === true ? dramaticConflictManager : null,
          foreshadowing_causal_graph: foreshadowingCausalGraph,
      foreshadowing_payoff_guard: foreshadowingPayoffGuard,
      foreshadowing_payoff_repair_planner: foreshadowingPayoffRepairPlanner,
      foreshadowing_payoff_acceptance_gate: foreshadowingPayoffAcceptanceGate,
      foreshadowing_settlement_diff_preview: foreshadowingSettlementDiffPreview,
        });
      } catch (error) {
        result.stop_reason = error?.provider_status ?? "provider_http_error";
        result.recursive_revision.stop_reason = result.stop_reason;
        result.report.warnings.push(result.stop_reason);
        break;
      }
      if (revised.provider_trace_id) {
        result.provider_trace_ids.push(revised.provider_trace_id);
      }
      const roundReport = {
        round,
        input_hash: sha256(draft),
        critique,
        recursive_revision_policy: recursiveRevisionPolicy,
        revision_plan: {
          ...revisionPlan,
          reader_response_revision_gate: readerResponseRevisionGate,
        },
        reader_response_simulator: readerResponseSimulator,
        reader_response_revision_gate: readerResponseRevisionGate,
        revised_draft_hash: revised.text ? sha256(revised.text) : "",
        revised_draft_chars: revised.text.length,
        final_polisher_status: "not_run",
        needs_structural_revision: true,
        accepted: false,
        stop_reason: null,
      };
      result.recursive_revision.rounds_attempted = round;
      if (!revised.text) {
        roundReport.stop_reason = "revision_adapter_returned_empty_text";
        result.recursive_revision.rounds.push(roundReport);
        result.stop_reason = roundReport.stop_reason;
        break;
      }
      draft = revised.text;
      providerForeshadowingPayoffs = collectForeshadowingPayoffs(revised);
      foreshadowingPayoffGuard = await refreshForeshadowingPayoffGuard(draft, providerForeshadowingPayoffs);
      foreshadowingPayoffRepairPlanner = await refreshForeshadowingPayoffRepairPlanner(draft);
      polisher = await runPolisher(draft, writingCardDirector, input, options, characterMindStateLedger, dramaticConflictManager, foreshadowingCausalGraph, foreshadowingPayoffGuard, foreshadowingPayoffRepairPlanner, foreshadowingPayoffAcceptanceGate, foreshadowingSettlementDiffPreview);
      polisher = applyForeshadowingPayoffRepairGate(polisher);
      providerForeshadowingPayoffs = collectForeshadowingPayoffs(revised, polisher);
      foreshadowingPayoffGuard = await refreshForeshadowingPayoffGuard(draft, providerForeshadowingPayoffs);
      foreshadowingPayoffRepairPlanner = await refreshForeshadowingPayoffRepairPlanner(draft);
      polisher = applyForeshadowingPayoffRepairGate(polisher);
      readerResponseRevisionGate = await refreshReaderResponseRevisionGate(polisher.polished_text || draft);
      polisher = applyReaderResponseRevisionGate(polisher);
      roundReport.final_polisher_status = polisher.status;
      roundReport.needs_structural_revision = polisher.needs_structural_revision === true;
      roundReport.accepted = polisher.status === "completed"
        && polisher.needs_structural_revision !== true
        && Boolean(polisher.polished_text);
      roundReport.stop_reason = roundReport.accepted ? "accepted" : "structural_revision_still_required";
      result.recursive_revision.rounds.push(roundReport);
      if (roundReport.accepted) {
        finalSource = "backend_recursive_revision";
        break;
      }
    }
  }

  const accepted = polisher.status === "completed"
    && polisher.needs_structural_revision !== true
    && Boolean(text(polisher.polished_text));
  if (!accepted) {
    result.pipeline_stage = "structural_revision_required";
    result.stop_reason = result.stop_reason
      ?? (result.recursive_revision.rounds_attempted >= input.maxRevisionRounds
        ? "max_revision_rounds_exhausted"
        : "structural_revision_required");
    result.recursive_revision.status = "failed";
    result.recursive_revision.stop_reason = result.stop_reason;
    result.final_polisher = {
      status: polisher.status,
      needs_structural_revision: polisher.needs_structural_revision === true,
      suggested_return_stage: polisher.suggested_return_stage ?? null,
      warnings: polisher.warnings ?? [],
    };
    result.report.warnings.push(...(polisher.warnings ?? []), result.stop_reason);
    refreshFullPipelineAcceptanceEvidencePacket("revision_required");
    return result;
  }

  result.status = "completed";
  result.pipeline_stage = result.recursive_revision.used
    ? "final_candidate_ready_after_revision"
    : "final_candidate_ready";
  result.final_candidate_text = text(polisher.polished_text);
  result.final_candidate_hash = sha256(result.final_candidate_text);
  result.final_candidate_source = finalSource;
  result.final_text_can_be_displayed = true;
  result.can_output_to_chat = true;
  result.recursive_revision.status = result.recursive_revision.used ? "revised" : "not_needed";
  result.recursive_revision.stop_reason = result.recursive_revision.used ? "accepted" : "not_needed";
  result.final_polisher = {
    status: polisher.status,
    needs_structural_revision: false,
    suggested_return_stage: null,
    warnings: polisher.warnings ?? [],
  };

  foreshadowingPayoffAcceptanceGate = await refreshForeshadowingPayoffAcceptanceGate();
  if (foreshadowingPayoffAcceptanceGate.used === true && foreshadowingPayoffAcceptanceGate.can_enter_adoption_review !== true) {
    result.adoption_requires_approval_queue = true;
    result.direct_adoption_allowed = false;
    result.report.adoption_requires_approval_queue = true;
    result.report.direct_adoption_allowed = false;
    result.report.warnings.push(...(foreshadowingPayoffAcceptanceGate.warnings ?? []));
  }

  foreshadowingSettlementDiffPreview = await refreshForeshadowingSettlementDiffPreview();
  if (foreshadowingSettlementDiffPreview.used === true) {
    result.pending_engine_candidate_created = false;
    result.canon_update_allowed = false;
    result.active_engine_update_allowed = false;
    result.report.foreshadowing_settlement_preview_only = true;
    result.report.pending_engine_candidate_created = false;
    result.report.canon_update_allowed = false;
    result.report.active_engine_update_allowed = false;
    result.report.warnings.push(...(foreshadowingSettlementDiffPreview.warnings ?? []));
  }

  if (foreshadowingPayoffRepairPlanner.revision_required === true) {


    result.adoption_requires_approval_queue = true;


    result.direct_adoption_allowed = false;


    result.report.foreshadowing_payoff_repair_planner_revision_required = true;


    result.report.adoption_requires_approval_queue = true;


    result.report.direct_adoption_allowed = false;


    result.report.warnings.push(...(foreshadowingPayoffRepairPlanner.warnings ?? []));


  }



  if (foreshadowingPayoffGuard.blocking === true) {


    result.adoption_requires_approval_queue = true;


    result.direct_adoption_allowed = false;


    result.report.foreshadowing_payoff_guard_blocking = true;


    result.report.adoption_requires_approval_queue = true;


    result.report.direct_adoption_allowed = false;


    result.report.warnings.push(...(foreshadowingPayoffGuard.warnings ?? []));


  }



  if (input.enableCharacterVoiceGuard) {
    const guard = typeof options.characterVoiceGuardAdapter === "function"
      ? await options.characterVoiceGuardAdapter({
        candidate_text: result.final_candidate_text,
        context_bundle: bundle,
      })
      : await evaluateCharacterVoiceDrift({
        candidate_text: result.final_candidate_text,
        context_bundle: bundle,
      }, options);
    const display = formatCharacterVoiceGuardForDisplay(guard);
    result.character_voice_guard = {
      used: true,
      verdict: guard?.verdict ?? guard?.character_voice_guard_verdict ?? null,
      severity: guard?.severity ?? guard?.character_voice_guard_severity ?? null,
      blocking: display.blocking,
      display,
    };
    result.adoption_requires_approval_queue = display.blocking;
    result.direct_adoption_allowed = false;
    result.report.character_voice_guard_blocking = display.blocking;
    result.report.adoption_requires_approval_queue = display.blocking;
    result.report.final_text_can_be_displayed = true;
    result.report.candidate_save_allowed = true;
    result.report.direct_adoption_allowed = false;
  }

  if (input.saveCandidate) {
    const saved = await saveChatOutputAsWritingCandidate({
      source_bundle_id: orchestration.pre_generation.bundle_id,
      chat_output_text: result.final_candidate_text,
      task_prompt: input.taskPrompt,
      source: "chatgpt",
      full_recursive_writing_pipeline_report: {
        pipeline_stage: result.pipeline_stage,
        final_candidate_source: result.final_candidate_source,
        recursive_revision: result.recursive_revision,
        character_mind_state_ledger: result.character_mind_state_ledger,
        dramatic_conflict_manager: result.dramatic_conflict_manager,
        foreshadowing_causal_graph: result.foreshadowing_causal_graph,
        foreshadowing_payoff_guard: result.foreshadowing_payoff_guard,
        foreshadowing_payoff_repair_planner: result.foreshadowing_payoff_repair_planner,
        foreshadowing_payoff_acceptance_gate: result.foreshadowing_payoff_acceptance_gate,
        foreshadowing_settlement_diff_preview: result.foreshadowing_settlement_diff_preview,
        reader_response_simulator: result.reader_response_simulator,
        reader_response_revision_gate: result.reader_response_revision_gate,
        report: result.report,
      },
    }, options);
    result.candidate_created = saved.candidate_created === true;
    result.candidate_id = saved.candidate_id ?? null;
    result.canon_status = saved.canon_status ?? "candidate_only";
    result.adopted = saved.adopted === true;
    result.settled = saved.settled === true;
    result.report.warnings.push(...(saved.warnings ?? []));
  }
  result.report.warnings.push(...result.generation.warnings, ...result.final_polisher.warnings);
  refreshFullPipelineAcceptanceEvidencePacket("accepted");
  return result;
}

export default runFullRecursiveWritingPipeline;
