import { createHash } from "node:crypto";
import { buildFullNeuralWritingOrchestration } from "./full-neural-writing-orchestrator-service.mjs";
import { runFinalPolisherEditorialBrain } from "./final-polisher-editorial-service.mjs";
import { saveChatOutputAsWritingCandidate } from "./chat-output-candidate-service.mjs";
import { evaluateCharacterVoiceDrift } from "./character-voice-drift-guard-service.mjs";
import { formatCharacterVoiceGuardForDisplay } from "./character-voice-guard-display.mjs";
import { buildCharacterMindStateLedgerContext } from "./character-mind-state-ledger-service.mjs";
import {
  buildGenerationAdapterFromProvider,
  buildRevisionAdapterFromProvider,
  resolveBackendGenerationProvider,
} from "./backend-generation-provider-service.mjs";

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

async function runPolisher(draftText, writingCardDirector, input, options, characterMindStateLedger = null) {
  if (typeof options.finalPolisherAdapter === "function") {
    const adapted = await options.finalPolisherAdapter({
      raw_draft_text: draftText,
      writing_card_director_context: writingCardDirector,
      generation_context: input.generationContext,
      retrieval_context: input.retrievalContext,
      character_mind_state_ledger: characterMindStateLedger,
    });
    return {
      status: adapted?.status ?? "completed",
      polished_text: text(adapted?.polished_text ?? adapted?.text ?? draftText),
      revision_report: adapted?.revision_report ?? null,
      needs_structural_revision: adapted?.needs_structural_revision === true,
      suggested_return_stage: adapted?.suggested_return_stage ?? null,
      warnings: Array.isArray(adapted?.warnings) ? adapted.warnings : [],
    };
  }
  return runFinalPolisherEditorialBrain({
    raw_draft_text: draftText,
    writing_card_director_context: writingCardDirector,
    generation_context: input.generationContext,
    retrieval_context: input.retrievalContext,
    character_mind_state_ledger: characterMindStateLedger,
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

function buildRevisionPlan(critique) {
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
  let polisher = await runPolisher(draft, writingCardDirector, input, options, characterMindStateLedger);
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
      const revisionPlan = buildRevisionPlan(critique);
      let revised;
      try {
        revised = await callAdapter(revisionAdapter, {
          round,
          task_prompt: input.taskPrompt,
          generation_context: input.generationContext,
          retrieval_context: input.retrievalContext,
          draft_text: draft,
          critique,
          revision_plan: revisionPlan,
          writing_context: writingContext,
          neural_pre_generation_report: orchestration.pre_generation,
          writing_card_director: writingCardDirector,
          character_mind_state_ledger: characterMindStateLedger,
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
        revision_plan: revisionPlan,
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
      polisher = await runPolisher(draft, writingCardDirector, input, options, characterMindStateLedger);
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
  return result;
}

export default runFullRecursiveWritingPipeline;
