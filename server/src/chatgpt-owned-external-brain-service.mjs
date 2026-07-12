import { createHash } from "node:crypto";
import { createAgentRun, finalizeAgentRun, getAgentRun } from "./agent-run-service.mjs";
import { buildGptWritingContext, getGptWritingContextBundle } from "./gpt-writing-context-service.mjs";
import {
  run_scene_planner,
  run_character_simulator,
  run_neural_critic,
  run_style_drift_detector,
  run_over_governance_detector,
  run_writing_card_director,
  run_final_polisher,
} from "./neural-module-service.mjs";
import { summarizeNeuralUsageForRun } from "./neural-trace-service.mjs";

export const externalBrainOwnership = Object.freeze({
  architecture_role: "gpt_external_brain",
  orchestration_mode: "chatgpt_owned_external_brain",
  orchestration_owner: "chatgpt",
  capability_consumer: "chatgpt",
  capability_provider: "writer_workbench",
  runtime_host: "writer_workbench_runtime",
  final_prose_generator: "chatgpt",
});

export const externalBrainPreGenerationCapabilities = Object.freeze([
  "run_scene_planner",
  "run_character_simulator",
  "run_neural_critic",
  "run_style_drift_detector",
  "run_over_governance_detector",
  "run_writing_card_director",
]);

const wrappers = {
  run_scene_planner,
  run_character_simulator,
  run_neural_critic,
  run_style_drift_detector,
  run_over_governance_detector,
  run_writing_card_director,
  run_final_polisher,
};

const safety = Object.freeze({
  candidate_created: false,
  canon_updated: false,
  active_engine_updated: false,
  adopted: false,
  settled: false,
});

export const externalBrainMutationGuards = safety;

const compactBootstrapCapabilities = Object.freeze([
  "scene_planner",
  "character_simulator",
  "neural_critic",
  "style_drift_detector",
  "over_governance_detector",
  "writing_card_director",
]);

function sha256(value) {
  return createHash("sha256").update(String(value ?? "")).digest("hex");
}

function requiredText(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  return value;
}

function sessionId(input = {}) {
  return input.external_brain_session_id ?? input.agent_run_id ?? input.run_id;
}

function bundleId(input = {}) {
  return input.writing_context_bundle_id ?? input.bundle_id;
}

function compactText(value, maxChars = 240) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxChars);
}

export function buildFinalPolisherEditorialContract(rawStoryText) {
  const story = requiredText(rawStoryText, "raw_story_text");
  const evidenceBinding = (requirement) => [{
    source: "raw_story_text",
    binding: "exact_passage_or_precise_location_required",
    requirement,
  }];
  return {
    result_type: "final_polisher_report",
    editorial_mode: "subtractive_whole_draft_review",
    report_status: "editorial_review_contract_ready",
    raw_story_sha256: sha256(story),
    editorial_review_required_for_success: true,
    text_change_required: false,
    release_recommendation: "release_as_is",
    release_condition: "Release unchanged only after ChatGPT completes the whole-draft review and finds no material evidence-backed issue.",
    prose_ownership: {
      final_prose_generator: "ChatGPT",
      writer_workbench_role: "post_generation_editorial_capability_provider",
      writer_workbench_generated_final_prose: false,
    },
    editorial_strategy: {
      primary: "editorial_subtraction",
      principle: "When the draft is already strong, prefer deletion, de-synchronization, compression, or silence over beautification.",
      preferred_operations: ["deletion", "de_synchronization", "compression", "silence"],
      prohibited_defaults: ["prose_beautification", "adjective_augmentation", "sensory_detail_injection", "metaphor_generation"],
    },
    findings: [
      {
        code: "pattern_saturation",
        finding_status: "requires_chatgpt_semantic_review",
        severity: "medium",
        evidence: evidenceBinding("Bind repeated narrative patterns to exact occurrences and identify the point after which their dramatic return diminishes."),
        diagnosis: "Determine whether repeated synchronization, dialogue reversals, punchline rhythms, or nearby sentence shapes have already completed their narrative function and become over-saturated.",
        revision_action: "If material, retain the strongest occurrences and delete, compress, vary, or de-synchronize later lower-yield repetitions.",
        preserve: ["causal_continuity", "character_agency", "strongest_pattern_payoff"],
      },
      {
        code: "symmetry_overcompleted",
        finding_status: "requires_chatgpt_semantic_review",
        severity: "medium",
        evidence: evidenceBinding("Quote or locate each parallel or mirrored beat and mark where the symmetry first becomes legible before judging later proof as excess."),
        diagnosis: "Determine whether a mirror or parallel structure remains emotionally productive, or whether accumulated proof makes the author's design visible after the symmetry is already complete.",
        revision_action: "Preserve the strongest emotionally productive mirror; delete, weaken, or de-synchronize weaker mirrors without damaging the core theme.",
        preserve: ["core_theme", "relationship_turn", "highest_value_mirror"],
      },
      {
        code: "callback_saturation",
        finding_status: "requires_chatgpt_semantic_review",
        severity: "medium",
        evidence: evidenceBinding("Bind callbacks to their earlier source and state what new relationship, information, emotion, comedy, or structural meaning each recurrence adds."),
        diagnosis: "Distinguish semantic, relationship, comic, and structural callbacks, then determine whether one class is too dense for the surrounding scene.",
        revision_action: "Remove the weakest callbacks first and preserve callbacks that materially change relationship, information, emotion, or scene meaning.",
        preserve: ["meaningful_payoff", "relationship_change", "chapter_turn"],
      },
      {
        code: "echo_only_callback",
        finding_status: "requires_chatgpt_semantic_review",
        severity: "low",
        evidence: evidenceBinding("Quote the source and recurrence and explain why the recurrence adds no new meaning before recommending deletion."),
        diagnosis: "Determine whether a repeated line, action, or image merely echoes its source instead of transforming its meaning.",
        revision_action: "Prefer deleting or compressing echo-only recurrence while leaving meaning-bearing callbacks intact.",
        preserve: ["semantic_callback", "relationship_callback", "comic_callback", "structural_callback"],
      },
      {
        code: "author_hand_visible",
        finding_status: "requires_chatgpt_semantic_review",
        severity: "high",
        evidence: evidenceBinding("Quote narration that appears to prove compliance with a setting, ability, governance, symmetry, or callback rule rather than simply dramatizing the event."),
        diagnosis: "Determine whether rule-proof narration exposes writing-card or governance machinery, including explicit proof that a character did not use an ability shortcut.",
        revision_action: "Delete the proof sentence or let ordinary physical consequence, character load, and natural action make the boundary invisible.",
        preserve: ["canon_boundary", "ordinary_physical_result", "character_agency"],
      },
      {
        code: "strong_beat_dilution",
        finding_status: "requires_chatgpt_semantic_review",
        severity: "high",
        evidence: evidenceBinding("Identify the exact high-value short line, pause, or silence and the nearby callbacks, jokes, or patterned beats competing with its emotional air."),
        diagnosis: "Determine whether surrounding cleverness or structural completion dilutes a strong emotional beat that should be allowed to breathe.",
        revision_action: "Protect the beat by reducing nearby low-value callbacks; add no explanatory narration and, when sufficient, only delete.",
        preserve: ["strong_emotional_beat", "silence", "character_unexplained_emotion"],
      },
    ],
    protected_beats: [{
      code: "strong_emotional_beat",
      selection_rule: "ChatGPT must bind protection to exact short lines, pauses, or silences in the supplied draft, including beats such as ‘沒有。’ when context gives them emotional weight.",
      protection: ["do_not_explain", "reduce_nearby_low_value_callbacks", "prefer_silence"],
    }],
    revision_priorities: [
      "Protect canon, causal continuity, character agency, the chapter turn, and strong emotional beats.",
      "Resolve high-severity evidence-backed author-hand visibility or strong-beat dilution first.",
      "Prefer deleting, de-synchronizing, or compressing lower-yield symmetry, pattern, and callback evidence.",
      "Do not mechanically apply every finding; revise only where exact draft evidence establishes material harm.",
    ],
    final_revision_instruction: [
      "ChatGPT remains the final prose generator.",
      "Complete a whole-draft editorial review of the supplied raw story and revise only when evidence-backed findings justify change.",
      "Preserve canon, causal continuity, character agency, the chapter turn, and strong emotional beats.",
      "Prefer subtractive editing: deletion, de-synchronization, compression, or silence over beautification.",
      "Do not mechanically apply every finding, add generic polish, or explain the revision.",
      "When story-only output was requested, output only the final revised story prose.",
      "If no material editorial issue exists after review, release the original text unchanged.",
    ].join(" "),
  };
}

function deterministicAdapter(capabilityName, rawStoryText = null) {
  return async (capabilityInput) => {
    const moduleName = capabilityName.slice(4);
    const taskPrompt = compactText(capabilityInput.task_prompt);
    const writingContext = capabilityInput.writing_context ?? {};
    const base = {
      capability_name: capabilityName,
      module_name: moduleName,
      orchestration_mode: externalBrainOwnership.orchestration_mode,
      orchestration_owner: externalBrainOwnership.orchestration_owner,
      runtime_host: externalBrainOwnership.runtime_host,
      input_digest: sha256(JSON.stringify(capabilityInput)),
    };
    if (capabilityName === "run_final_polisher") {
      return {
        ...base,
        generation_boundary: "post_generation",
        ...buildFinalPolisherEditorialContract(rawStoryText),
      };
    }
    const semanticOutputs = {
      run_scene_planner: {
        result_type: "scene_plan",
        objective: taskPrompt,
        scene_beats: [
          "Open on concrete sensory action and immediate pressure.",
          "Escalate through a character choice with a visible consequence.",
          "Close the movement on a readable turn that advances the chapter.",
        ],
        continuity_anchor_present: Boolean(writingContext.content?.chapter_anchor),
      },
      run_character_simulator: {
        result_type: "character_simulation",
        dramatic_situation: taskPrompt,
        behavior_constraints: [
          "Let each character act from current knowledge, position, and relationship pressure.",
          "Carry tension through gesture, silence, hesitation, and subtext instead of queue-style dialogue.",
          "Preserve distinct character agency; do not flatten the ensemble into an operator voice.",
        ],
        voice_registry_loaded: writingContext.character_voice_registry_loaded === true,
      },
      run_neural_critic: {
        result_type: "neural_critique",
        critique_focus: taskPrompt,
        risks: [
          "Avoid engineering, provider, workflow, and handoff language in story prose.",
          "Preserve causal continuity and do not invent unsupported canon facts.",
          "Prefer dramatized action over abstract explanation or theme-first summary.",
        ],
      },
      run_style_drift_detector: {
        result_type: "style_drift_report",
        target: taskPrompt,
        drift_risk: "monitor",
        drift_signals: [
          "Administrative or checklist-like narration.",
          "Over-short punchlines that break long-form cadence.",
          "Abstract exposition replacing concrete action, sensory detail, or natural dialogue.",
        ],
      },
      run_over_governance_detector: {
        result_type: "over_governance_report",
        target: taskPrompt,
        governance_risk: "guardrails_must_remain_invisible",
        release_constraints: [
          "Use governance context as invisible boundaries, never as visible story vocabulary.",
          "Do not turn dramatic conflict into policy, tool, or process debate.",
          "Keep character agency and scene momentum alive inside the canon constraints.",
        ],
      },
      run_writing_card_director: {
        result_type: "writing_card_director_context",
        direction: taskPrompt,
        director_notes: [
          "Write direct story prose with vivid scene motion and living character reactions.",
          "Maintain high-density chapter progression and a concrete chapter-level turn.",
          "When story-only output is requested, begin with the chapter title or prose rather than a handoff summary.",
        ],
        writing_card_context: writingContext.content?.writing_card_director_context ?? null,
      },
    };
    return {
      ...base,
      generation_boundary: "pre_generation",
      ...semanticOutputs[capabilityName],
    };
  };
}

export async function beginChatgptOwnedExternalBrainWritingSession(input = {}, options = {}) {
  const context = await buildGptWritingContext({
    task_prompt: input.task_prompt,
    generation_context: input.generation_context ?? {},
    retrieval_context: input.retrieval_context ?? {},
    chapter_mode: input.chapter_mode ?? "next_chapter",
    output_mode: "chat_only",
    max_context_chars: input.max_context_chars ?? 48000,
    include_active_engine: true,
    include_writing_card: true,
    include_proofing_card: true,
    include_longline: true,
  }, options);
  const run = await createAgentRun({
    task_type: "draft_generation",
    mode: externalBrainOwnership.orchestration_mode,
    created_by: "chatgpt",
    requires_neural_modules: true,
    required_neural_modules: [...externalBrainPreGenerationCapabilities, "run_final_polisher"]
      .map((name) => name.slice(4)),
    input: JSON.stringify({
      task_prompt: input.task_prompt,
      writing_context_bundle_id: context.bundle.bundle_id,
      orchestration_owner: "chatgpt",
    }),
  });
  return {
    ok: true,
    tool_name: "chatgpt_bridge_begin_external_brain_writing_session",
    status: "ready_for_chatgpt_owned_orchestration",
    architecture_route: externalBrainOwnership.orchestration_mode,
    external_brain_session_id: run.run_id,
    writing_context_bundle_id: context.bundle.bundle_id,
    orchestration_owner: "ChatGPT",
    prose_generator: "ChatGPT",
    next_capabilities: [...compactBootstrapCapabilities],
    mutation_guards: { ...safety },
    ...safety,
  };
}

export async function useChatgptOwnedExternalBrainCapability(capabilityName, input = {}, options = {}) {
  const wrapper = wrappers[capabilityName];
  if (!wrapper) throw new Error(`Unknown external brain capability: ${capabilityName}`);
  const runId = requiredText(sessionId(input), "external_brain_session_id");
  const contextBundleId = requiredText(bundleId(input), "writing_context_bundle_id");
  const run = await getAgentRun(runId);
  if (run.mode !== externalBrainOwnership.orchestration_mode) {
    throw new Error("agent_run_id is not a ChatGPT-owned external brain writing session.");
  }
  const context = await getGptWritingContextBundle(contextBundleId, options);
  const isFinalPolisher = capabilityName === "run_final_polisher";
  const rawStoryText = isFinalPolisher
    ? requiredText(input.raw_story_text, "raw_story_text")
    : null;
  if (isFinalPolisher) {
    const usage = await summarizeNeuralUsageForRun(runId);
    const completed = new Set(usage.neural_modules_used ?? []);
    const missing = externalBrainPreGenerationCapabilities
      .map((name) => name.slice(4))
      .filter((name) => !completed.has(name));
    if (missing.length) {
      throw new Error(`final_polisher is post-generation and requires all pre-generation capabilities first: ${missing.join(", ")}.`);
    }
  }
  const generationBoundary = isFinalPolisher ? "post_generation" : "pre_generation";
  const capabilityInput = isFinalPolisher ? {
    module_name: capabilityName,
    generation_boundary: generationBoundary,
    raw_story_text: rawStoryText,
    raw_story_sha256: sha256(rawStoryText),
    writing_context_bundle_id: contextBundleId,
    capability_input: input.capability_input ?? {},
  } : {
    module_name: capabilityName,
    generation_boundary: generationBoundary,
    task_prompt: context.bundle.task_prompt,
    writing_context_bundle_id: contextBundleId,
    writing_context: context.bundle,
    capability_input: input.capability_input ?? {},
  };
  const execution = await wrapper(capabilityInput, {
    run_id: runId,
    task_type: "draft_generation",
    source: "chatgpt_owned_external_brain_mcp",
    adapter: options.adapter ?? deterministicAdapter(capabilityName, rawStoryText),
  });
  const finalizedRun = isFinalPolisher
    ? await finalizeAgentRun(runId, { output: execution.output })
    : null;
  return {
    ok: execution.trace?.status === "success",
    tool_name: `chatgpt_bridge_use_${capabilityName.slice(4)}`,
    architecture_route: externalBrainOwnership.orchestration_mode,
    capability_name: capabilityName,
    generation_boundary: generationBoundary,
    orchestration_owner: "ChatGPT",
    prose_generator: "ChatGPT",
    full_neural_orchestrator_used: false,
    external_brain_session_id: runId,
    writing_context_bundle_id: contextBundleId,
    ...(isFinalPolisher ? { raw_story_sha256: sha256(rawStoryText) } : {}),
    capability_output: execution.output,
    trace: {
      trace_id: execution.trace?.trace_id ?? null,
      run_id: execution.trace?.run_id ?? runId,
      module_name: execution.trace?.module_name ?? capabilityName.slice(4),
      status: execution.trace?.status ?? "failed",
      output_hash: execution.trace?.output_hash ?? null,
    },
    agent_run_status: finalizedRun?.status ?? run.status,
    mutation_guards: { ...safety },
    ...safety,
  };
}
