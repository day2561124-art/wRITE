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

function deterministicAdapter(capabilityName, rawStoryText = null) {
  return async (capabilityInput) => {
    const base = {
      capability_name: capabilityName,
      module_name: capabilityName,
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
    return {
      ...base,
      generation_boundary: "pre_generation",
      guidance: `Writer Workbench executed ${capabilityName} for ChatGPT to integrate before prose generation.`,
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
    tool_name: `chatgpt_bridge_use_${capabilityName.slice(4)}`,
    capability_name: capabilityName,
    requested_capability: capabilityName,
    returned_capability: capabilityName,
    generation_boundary: generationBoundary,
    ...externalBrainOwnership,
    external_brain_session_id: runId,
    agent_run_id: runId,
    neural_trace_run_id: runId,
    writing_context_bundle_id: contextBundleId,
    raw_story_sha256: isFinalPolisher ? sha256(rawStoryText) : null,
    capability_result: execution.output,
    trace: execution.trace,
    agent_run_status: finalizedRun?.status ?? run.status,
    ...safety,
  };
}
