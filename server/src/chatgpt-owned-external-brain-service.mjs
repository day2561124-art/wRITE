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
        raw_story_sha256: sha256(rawStoryText),
        polished_text: rawStoryText,
        revision_report: [
          "Review cadence, sensory clarity, dialogue naturalness, and canon continuity.",
          "The returned text remains input for ChatGPT; Writer Workbench does not emit final prose.",
        ],
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
