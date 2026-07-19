import { performance } from "node:perf_hooks";
import { getAgentRun } from "./agent-run-service.mjs";
import {
  hashNeuralValue,
  recordNeuralWrapperTrace,
} from "./neural-trace-service.mjs";
import {
  persistExternalBrainCognitionOutput,
  priorAuthorshipCognitionModules,
  serializeCognitionCapabilityOutput,
} from "./external-brain-cognition-output-service.mjs";
import {
  buildExternalBrainGenerationSurface,
} from "./external-brain-generation-surface-service.mjs";

const moduleSpecs = {
  scene_planner: {
    model_name: "local-scene-planner",
    model_version: "v1.0.0",
    result_type: "scene_plan",
  },
  character_simulator: {
    model_name: "local-character-simulator",
    model_version: "v1.1.0-phase50b-single-turn",
    result_type: "character_simulation",
  },
  neural_critic: {
    model_name: "local-neural-critic",
    model_version: "v1.1.0-phase50c-exact-line",
    result_type: "neural_critique",
  },
  style_drift_detector: {
    model_name: "local-style-drift-detector",
    model_version: "v1.1.0-phase50c-exact-line",
    result_type: "style_drift_report",
  },
  over_governance_detector: {
    model_name: "local-over-governance-detector",
    model_version: "v1.0.0",
    result_type: "over_governance_report",
  },
  writing_card_director: {
    model_name: "local-writing-card-director",
    model_version: "v1.0.0",
    result_type: "writing_card_director_context",
  },
  final_polisher: {
    model_name: "local-final-polisher",
    model_version: "v1.0.0",
    result_type: "final_polisher_report",
  },
};

function inputText(value) {
  if (typeof value === "string") return value;
  return JSON.stringify(value ?? null);
}

const storyMaterialProfiles = Object.freeze({
  scene_planner: Object.freeze({
    role: "supply concrete event and scene materials",
    keywords: /(?:scene|event|recent|current|aftermath|consequence|injury|location|time|pending|unresolved|decision|conflict|misunderstanding|場景|事件|最近|目前|後果|傷勢|地點|時間|待處理|未解決|決定|衝突|誤會)/iu,
    cognition_tasks: Object.freeze([
      "identify what is concretely happening now",
      "identify material consequences left by prior events",
      "separate scene functions by new information, decision, conflict, misunderstanding, practical consequence, or relationship-position change",
      "flag repeated emotional payment",
      "locate a natural concrete stopping point",
    ]),
  }),
  character_simulator: Object.freeze({
    role: "supply character-specific motives, limits, reactions, and speech pressure",
    keywords: /(?:character|relationship|emotion|want|worry|fear|knowledge|voice|habit|state|injury|boundary|角色|關係|情緒|想要|在意|擔心|害怕|知道|語氣|習慣|狀態|傷勢|界線)/iu,
    cognition_tasks: Object.freeze([
      "identify what each character currently wants or avoids",
      "derive likely action from personality and present pressure",
      "preserve knowledge limits and possible misunderstanding",
      "test whether dialogue is too complete, mature, correct, or thesis-like",
      "preserve unfinished emotion and unresolved relationship residue",
    ]),
  }),
  neural_critic: Object.freeze({
    role: "run exact-line hard-risk review only after draft evidence exists",
    keywords: /(?:theme|title|symbol|image|callback|emotion|reconcile|ending|summary|主題|章名|象徵|意象|回呼|情緒|和解|結尾|總結)/iu,
    cognition_tasks: Object.freeze([
      "check theme-first construction",
      "check chapter-title service and symbolic stacking",
      "check repeated emotional payment",
      "check characters speaking for the author",
      "check premature reconciliation or conflict resolution",
      "check beautiful but nonfunctional passages",
      "remain inactive before draft evidence exists",
      "cite exact draft lines for material hard conflicts",
      "mark must-fix only when exact evidence supports it",
      "offer minimum local revision direction instead of rewriting",
    ]),
  }),
  style_drift_detector: Object.freeze({
    role: "run exact-line style-drift review only after draft evidence exists",
    keywords: /(?:draft|prose|narration|ending|summary|parallel|symmetry|style|草稿|正文|旁白|結尾|總結|排比|對稱|風格)/iu,
    cognition_tasks: Object.freeze([
      "check narrator summary and explanatory overreach",
      "check uplifted or meaning-closing endings",
      "check essay-like or fable-like diction",
      "check overly tidy symmetry, parallelism, and designed closure",
      "run again after draft evidence is available",
      "remain inactive before draft evidence exists",
      "cite exact lines for explanation, proposition, or workflow leakage",
      "distinguish hard workflow leakage from advisory style drift",
      "offer minimum local revision direction instead of replacement prose",
    ]),
  }),
  over_governance_detector: Object.freeze({
    role: "prevent rules and modules from becoming plot generators",
    keywords: /(?:rule|guard|require|must|ensemble|growth|injury|romance|governance|規則|防錯|必須|群像|成長|受傷|戀愛|治理)/iu,
    cognition_tasks: Object.freeze([
      "do not force injury merely to prove consequence",
      "do not force viewpoint changes merely to prove ensemble scope",
      "do not arrange lessons merely to prove character growth",
      "do not hold every intimate scene at one uniform restraint level",
      "treat rules as error boundaries rather than story generators",
    ]),
  }),
  writing_card_director: Object.freeze({
    role: "integrate necessary materials while limiting module interference",
    keywords: /(?:anchor|canon|character|scene|event|risk|context|錨點|正史|角色|場景|事件|風險|脈絡)/iu,
    cognition_tasks: Object.freeze([
      "integrate canon, character, event, scene, and risk materials for ChatGPT",
      "preserve uncertainty, contradiction, and unfinished states",
      "rank only material hard constraints and concrete consequences",
      "do not assign theme, symbol chain, chapter-title meaning, or complete emotional arc",
      "leave final selection, narration, dialogue, and prose to ChatGPT",
    ]),
  }),
});

const storyMaterialGuardrails = Object.freeze({
  story_first: "understand characters and report what they are actually living through",
  theme_first_forbidden: true,
  chapter_title_must_not_direct_events: true,
  symbol_chain_must_not_be_generated: true,
  complete_emotional_arc_not_required: true,
  reconciliation_may_remain_incomplete: true,
  natural_concrete_stop_preferred: true,
  rules_are_guardrails_not_plot_generators: true,
  final_story_judgment_owner: "ChatGPT",
});



function outputText(value) {
  return serializeCognitionCapabilityOutput(value ?? null);
}

function objectValue(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

function compactScalar(value, maxChars = 320) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim().slice(0, maxChars);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value).slice(0, maxChars);
  } catch {
    return String(value).slice(0, maxChars);
  }
}

function collectMatchingMaterial(value, pathPrefix, keywordPattern, output, seen, depth = 0) {
  if (output.length >= 8 || depth > 5 || value === null || value === undefined) return;
  if (typeof value !== "object") {
    if (keywordPattern.test(pathPrefix)) {
      const content = compactScalar(value);
      if (content) output.push({ path: pathPrefix, content });
    }
    return;
  }
  if (seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    if (keywordPattern.test(pathPrefix)) {
      const content = compactScalar(value, 320);
      if (content) output.push({ path: pathPrefix, content });
      return;
    }
    value.slice(0, 8).forEach((item, index) => {
      collectMatchingMaterial(item, `${pathPrefix}[${index}]`, keywordPattern, output, seen, depth + 1);
    });
    return;
  }
  for (const [key, item] of Object.entries(value)) {
    if (output.length >= 8) break;
    const path = pathPrefix ? `${pathPrefix}.${key}` : key;
    if (keywordPattern.test(key) && item !== null && typeof item === "object") {
      const content = compactScalar(item, 320);
      if (content) output.push({ path, content });
      continue;
    }
    collectMatchingMaterial(item, path, keywordPattern, output, seen, depth + 1);
  }
}

function groundedMaterialFor(moduleName, input) {
  const profile = storyMaterialProfiles[moduleName];
  if (!profile) return [];
  const writingContext = objectValue(input?.writing_context);
  const capabilityInput = objectValue(input?.capability_input);
  const scopes = [
    ["chapter_anchor", writingContext.content?.chapter_anchor],
    ["generation_context", writingContext.inputs?.generation_context ?? writingContext.content?.generation_context],
    ["retrieval_context", writingContext.inputs?.retrieval_context ?? writingContext.content?.retrieval_context],
    ["capability_input", capabilityInput],
  ];
  const output = [];
  const seen = new WeakSet();
  for (const [label, value] of scopes) {
    collectMatchingMaterial(value, label, profile.keywords, output, seen);
    if (output.length >= 8) break;
  }
  return output;
}

function priorCognitionManifest(input) {
  const sources = input?.authorship_cognition_sources?.prior_cognition_outputs;
  if (!Array.isArray(sources)) return [];
  return sources.slice(0, 6).map((source) => ({
    module_name: source.module_name ?? null,
    result_type: source.result_type ?? null,
    output_hash: source.output_hash ?? null,
    story_material_present:
      source.capability_output?.story_material_cognition !== undefined,
  }));
}

export function buildStoryMaterialCognitionContract(moduleName, input = {}) {
  const profile = storyMaterialProfiles[moduleName];
  if (!profile) return null;
  const groundedMaterial = groundedMaterialFor(moduleName, input);
  const taskPrompt = compactScalar(input?.task_prompt, 480);
  const priorManifest = moduleName === "writing_card_director"
    ? priorCognitionManifest(input)
    : [];
  return {
    contract_version: "v1.0.0",
    architecture_role: "chatgpt_external_brain_story_material",
    capability_consumer: "ChatGPT",
    module_role: profile.role,
    ...(taskPrompt ? { task_prompt_anchor: taskPrompt } : {}),
    grounded_material: groundedMaterial,
    cognition_tasks: [...profile.cognition_tasks],
    ...(priorManifest.length ? {
      integrated_prior_cognition: priorManifest,
    } : {}),
    guardrails: { ...storyMaterialGuardrails },
    output_boundary:
      "Supply necessary story materials and risks; do not dictate theme, symbolism, chapter meaning, or final prose.",
  };
}

function attachStoryMaterialCognition(moduleName, input, output, options) {
  if (
    options.story_material_cognition_output !== true
    || moduleName === "final_polisher"
    || !output
    || typeof output !== "object"
    || Array.isArray(output)
  ) {
    return output;
  }
  return {
    ...output,
    story_material_cognition:
      buildStoryMaterialCognitionContract(moduleName, input),
  };
}

async function runModule(moduleName, input, options = {}) {
  const spec = moduleSpecs[moduleName];
  if (!spec) throw new Error(`Unknown neural module: ${moduleName}`);
  const runId = options.run_id;
  const agentRunOptions = options.fixtureRoot ? { fixtureRoot: options.fixtureRoot } : {};
  const run = await getAgentRun(runId, agentRunOptions);
  const taskType = options.task_type ?? run.task_type;
  if (taskType !== run.task_type) throw new Error("task_type must match the agent run.");
  const source = options.source ?? "local_ui";
  const calledAt = new Date().toISOString();
  const startedAt = performance.now();
  const inputValue = inputText(input);
  const inputHash = hashNeuralValue(inputValue);
  const modelName = options.model_name ?? spec.model_name;
  const modelVersion = options.model_version ?? spec.model_version;
  let status = "skipped";
  let output = null;
  let persistedOutput = null;
  let outputHash = null;
  let generationSurfaceHash = null;
  let generationSurfaceCompacted = false;
  let errorMessage = null;
  let warnings = [];

  if (typeof options.adapter !== "function") {
    warnings = ["Local neural model adapter is not configured."];
  } else {
    try {
      output = await options.adapter(input, {
        run_id: runId,
        task_type: taskType,
        module_name: moduleName,
        model_name: modelName,
        model_version: modelVersion,
      });
      persistedOutput = attachStoryMaterialCognition(
        moduleName,
        input,
        output,
        options,
      );
      const serializedPersistedOutput = outputText(persistedOutput);
      outputHash = hashNeuralValue(serializedPersistedOutput);
      if (options.generation_surface_output === true) {
        output = buildExternalBrainGenerationSurface(
          moduleName,
          persistedOutput,
        );
        generationSurfaceCompacted =
          serializeCognitionCapabilityOutput(output)
          !== serializedPersistedOutput;
      } else {
        output = persistedOutput;
      }
      generationSurfaceHash = hashNeuralValue(outputText(output));
      status = "success";
    } catch (error) {
      status = "failed";
      errorMessage = error instanceof Error ? error.message : String(error);
    }
  }

  const latencyMs = Math.max(0, Math.round(performance.now() - startedAt));
  const trace = await recordNeuralWrapperTrace({
    run_id: runId,
    ...(options.writing_context_bundle_id ? {
      writing_context_bundle_id: options.writing_context_bundle_id,
    } : {}),
    ...(input && typeof input === "object" && input.raw_story_handoff_id ? {
      raw_story_handoff_id: input.raw_story_handoff_id,
    } : {}),
    task_type: taskType,
    module_name: moduleName,
    model_name: modelName,
    model_version: modelVersion,
    called_at: calledAt,
    input_hash: inputHash,
    output_hash: outputHash,
    status,
    latency_ms: latencyMs,
    warnings,
    error_message: errorMessage,
    input_summary: {
      chars: inputValue.length,
      source,
    },
    output_summary: {
      chars: persistedOutput === null ? 0 : outputText(persistedOutput).length,
      generation_surface_chars: output === null ? 0 : outputText(output).length,
      generation_surface_hash: generationSurfaceHash,
      generation_surface_compacted: generationSurfaceCompacted,
      result_type: spec.result_type,
    },
  }, agentRunOptions);
  if (
    status === "success"
    && options.external_brain_cognition_output === true
    && priorAuthorshipCognitionModules.includes(moduleName)
  ) {
    await persistExternalBrainCognitionOutput({
      run_id: runId,
      writing_context_bundle_id: options.writing_context_bundle_id,
      capability_name: `run_${moduleName}`,
      module_name: moduleName,
      result_type: spec.result_type,
      trace,
      capability_output: persistedOutput,
    }, agentRunOptions);
  }
  return {
    output,
    trace,
    control_plane: {
      persisted_output_hash: outputHash,
      generation_surface_hash: generationSurfaceHash,
      generation_surface_compacted: generationSurfaceCompacted,
    },
  };
}

export function run_scene_planner(input, options) {
  return runModule("scene_planner", input, options);
}

export function run_character_simulator(input, options) {
  return runModule("character_simulator", input, options);
}

export function run_neural_critic(input, options) {
  return runModule("neural_critic", input, options);
}

export function run_style_drift_detector(input, options) {
  return runModule("style_drift_detector", input, options);
}

export function run_over_governance_detector(input, options) {
  return runModule("over_governance_detector", input, options);
}

export function run_writing_card_director(input, options) {
  return runModule("writing_card_director", input, options);
}

export function run_final_polisher(input, options) {
  return runModule("final_polisher", input, options);
}
