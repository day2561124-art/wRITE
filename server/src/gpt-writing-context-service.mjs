import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { getEngineComponentsStatus } from "./engine-component-registry.mjs";
import { commitFileTransaction } from "./file-transactions.mjs";
import {
  assertPathInside,
  normalizeProjectPath,
  projectPaths,
  projectRoot,
} from "./project-paths.mjs";

const bundleIdPattern = /^gptctx_\d{8}-\d{6}-[a-f0-9]{8}$/u;
const chapterModes = new Set(["next_chapter", "specific_scene", "rewrite_candidate"]);
const outputModes = new Set(["chat_only", "candidate_save_later"]);
const defaultMaxContextChars = 120_000;
const maximumContextChars = 250_000;
const taskPromptMaxLength = 12_000;

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function stamp(date = new Date()) {
  const compact = date.toISOString().replace(/\D/gu, "").slice(0, 14);
  return `${compact.slice(0, 8)}-${compact.slice(8)}`;
}

function createBundleId() {
  return `gptctx_${stamp()}-${randomBytes(4).toString("hex")}`;
}

function requiredText(value, label, maxLength) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  const text = value.trim();
  if (text.length > maxLength) throw new Error(`${label} exceeds ${maxLength} characters.`);
  return text;
}

function optionalObject(value, label) {
  if (value === undefined || value === null) return {};
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value;
}

function optionalBoolean(value, fallback, label) {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "boolean") throw new Error(`${label} must be a boolean.`);
  return value;
}

function optionalInteger(value, fallback, label, maximum) {
  if (value === undefined || value === null) return fallback;
  if (!Number.isInteger(value) || value < 1 || value > maximum) {
    throw new Error(`${label} must be an integer between 1 and ${maximum}.`);
  }
  return value;
}

function normalizeInput(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("input must be an object.");
  }
  const chapterMode = String(input.chapter_mode ?? input.chapterMode ?? "next_chapter").trim();
  const outputMode = String(input.output_mode ?? input.outputMode ?? "chat_only").trim();
  if (!chapterModes.has(chapterMode)) throw new Error(`Unknown chapter_mode: ${chapterMode}`);
  if (!outputModes.has(outputMode)) throw new Error(`Unknown output_mode: ${outputMode}`);
  return {
    taskPrompt: requiredText(
      input.task_prompt ?? input.taskPrompt,
      "task_prompt",
      taskPromptMaxLength,
    ),
    generationContext: optionalObject(
      input.generation_context ?? input.generationContext,
      "generation_context",
    ),
    retrievalContext: optionalObject(
      input.retrieval_context ?? input.retrievalContext,
      "retrieval_context",
    ),
    chapterMode,
    outputMode,
    includeActiveEngine: optionalBoolean(
      input.include_active_engine ?? input.includeActiveEngine,
      true,
      "include_active_engine",
    ),
    includeWritingCard: optionalBoolean(
      input.include_writing_card ?? input.includeWritingCard,
      true,
      "include_writing_card",
    ),
    includeProofingCard: optionalBoolean(
      input.include_proofing_card ?? input.includeProofingCard,
      true,
      "include_proofing_card",
    ),
    includeLongline: optionalBoolean(
      input.include_longline ?? input.includeLongline,
      true,
      "include_longline",
    ),
    maxContextChars: optionalInteger(
      input.max_context_chars ?? input.maxContextChars,
      defaultMaxContextChars,
      "max_context_chars",
      maximumContextChars,
    ),
  };
}

function rootsFor(options = {}) {
  const gptWritingContexts = options.gptWritingContexts
    ? assertPathInside(
      options.gptWritingContexts,
      projectPaths.outputs,
      "GPT writing contexts test root",
    )
    : projectPaths.gptWritingContexts;
  return { gptWritingContexts };
}

function bundlePaths(bundleId, roots) {
  if (!bundleIdPattern.test(String(bundleId ?? ""))) throw new Error("Invalid bundle_id.");
  const directory = path.join(roots.gptWritingContexts, bundleId);
  return {
    directory,
    bundle: path.join(directory, "context_bundle.json"),
    chat: path.join(directory, "context_for_chat.md"),
  };
}

async function sourceSnapshot(label, filePath, included, canonStatus) {
  const sourcePath = normalizeProjectPath(filePath);
  if (!included) {
    return {
      label,
      path: sourcePath,
      included: false,
      exists: null,
      hash: null,
      modified_at: null,
      canon_status: canonStatus,
      content: "",
    };
  }
  try {
    const [content, fileStat] = await Promise.all([readFile(filePath, "utf8"), stat(filePath)]);
    return {
      label,
      path: sourcePath,
      included: true,
      exists: true,
      hash: sha256(content),
      modified_at: fileStat.mtime.toISOString(),
      canon_status: canonStatus,
      content,
    };
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return {
      label,
      path: sourcePath,
      included: true,
      exists: false,
      hash: null,
      modified_at: null,
      canon_status: canonStatus,
      content: "",
    };
  }
}

function serializeContext(value) {
  return JSON.stringify(value, null, 2);
}

function allocateContent(sections, maxChars) {
  let remaining = maxChars;
  const content = {};
  const truncation = [];
  for (const section of sections) {
    const text = String(section.text ?? "");
    if (!text) {
      content[section.key] = "";
      continue;
    }
    if (remaining <= 0) {
      content[section.key] = `[omitted: context budget exhausted; source=${section.reference}]`;
      truncation.push(section.key);
      continue;
    }
    if (text.length <= remaining) {
      content[section.key] = text;
      remaining -= text.length;
      continue;
    }
    const suffix = `\n\n[truncated; source=${section.reference}]`;
    const allowed = Math.max(0, remaining - suffix.length);
    content[section.key] = `${text.slice(0, allowed)}${suffix}`;
    truncation.push(section.key);
    remaining = 0;
  }
  return {
    content,
    context_chars_used: maxChars - remaining,
    context_chars_limit: maxChars,
    truncated_sections: truncation,
  };
}

function chatMarkdown(bundle) {
  const sourceLines = Object.values(bundle.sources).map((source) => (
    `- ${source.label}: included=${source.included}, exists=${source.exists}, hash=${source.hash ?? "none"}, path=${source.path}`
  ));
  const engineStatus = bundle.engine_components_status;
  const requiredNeuralModules = bundle.required_neural_modules
    .map((moduleName) => `  - ${moduleName}`);
  return [
    "# GPT Writing Context Bundle",
    "",
    "## Task Prompt",
    "",
    bundle.task_prompt,
    "",
    "## 完整創作引擎狀態",
    "",
    `- Engine-first：${bundle.engine_first}`,
    `- active_engine：${engineStatus.components?.canon_data?.hash_matches ? "valid" : "invalid"}`,
    `- active_engine path：${engineStatus.components?.canon_data?.path ?? "unavailable"}`,
    `- active_engine expected SHA-256 (LF)：${engineStatus.components?.canon_data?.expected_sha256_lf ?? "unavailable"}`,
    `- active_engine actual SHA-256 (LF)：${engineStatus.components?.canon_data?.actual_sha256_lf ?? "unavailable"}`,
    `- writing_method：${engineStatus.components?.writing_method?.version ?? "unavailable"}`,
    `- proofing_method：${engineStatus.components?.proofing_method?.version ?? "unavailable"}`,
    `- neural_pipeline：${bundle.neural_pipeline_required ? "required" : "optional"}`,
    "- required neural modules：",
    ...requiredNeuralModules,
    `- governance policy present：${engineStatus.components?.governance_policy?.exists === true}`,
    "- canon update permission：none",
    "- any canon change：requires user approval",
    ...(bundle.engine_component_validation_errors.length
      ? [
        "- validation errors：",
        ...bundle.engine_component_validation_errors.map((error) => `  - ${error}`),
      ]
      : []),
    "",
    "## Canon Sources",
    "",
    ...sourceLines,
    "",
    "## Current Canon / Engine Context",
    "",
    bundle.content.active_engine_excerpt_or_reference || "[not included or missing]",
    "",
    "## Writing Card",
    "",
    bundle.content.writing_card_excerpt_or_reference || "[not included or missing]",
    "",
    "## Proofing Card",
    "",
    bundle.content.proofing_card_excerpt_or_reference || "[not included or missing]",
    "",
    "## Longline / Current Arc",
    "",
    bundle.content.longline_excerpt_or_reference || "[not included or missing]",
    "",
    "## Retrieval Context",
    "",
    bundle.content.retrieval_context_for_chat,
    "",
    "## Generation Context",
    "",
    bundle.content.generation_context_for_chat,
    "",
    "## Output Rules",
    "",
    "- Write the requested candidate directly in chat.",
    "- Do not call a local generation adapter or external model API.",
    "- Do not save a candidate draft automatically.",
    "- Do not adopt, settle, approve, activate, rollback, or execute cleanup.",
    "- Do not modify active_engine.md or any canon source.",
    "- Any later canon change must use the existing approval workflow.",
    "- If the task cannot continue safely, output only the stop reason.",
    "",
  ].join("\n");
}

async function engineStatusFor(options) {
  try {
    const status = typeof options.engineComponentsStatusProvider === "function"
      ? await options.engineComponentsStatusProvider()
      : await getEngineComponentsStatus(options.engineComponentRegistryOptions);
    const validationErrors = status.ok === true
      ? []
      : status.issues?.length
        ? [...status.issues]
        : ["Engine component validation failed."];
    return { status, validationErrors };
  } catch (error) {
    return {
      status: {
        ok: false,
        read_only: true,
        engine_id: null,
        design_principle: "engine-first",
        components: {},
        issues: [error.message],
      },
      validationErrors: [error.message],
    };
  }
}

export async function buildGptWritingContext(rawInput, options = {}) {
  const input = normalizeInput(rawInput);
  const roots = rootsFor(options);
  await mkdir(roots.gptWritingContexts, { recursive: true });
  const {
    status: engineComponentsStatus,
    validationErrors: engineComponentValidationErrors,
  } = await engineStatusFor(options);
  const requiredNeuralModules = (
    engineComponentsStatus.components?.neural_pipeline?.modules ?? []
  )
    .filter((module) => module.required_status === "available")
    .map((module) => module.name);
  const bundleId = createBundleId();
  const paths = bundlePaths(bundleId, roots);
  const activeEnginePath = options.activeEnginePath
    ? assertPathInside(options.activeEnginePath, projectPaths.canonDb, "active engine test path")
    : projectPaths.activeEngine;
  const sourceList = await Promise.all([
    sourceSnapshot("active_engine", activeEnginePath, input.includeActiveEngine, "active"),
    sourceSnapshot(
      "active_writing_card",
      path.join(projectRoot, "data", "writing_policy_db", "active_writing_card.md"),
      input.includeWritingCard,
      "policy",
    ),
    sourceSnapshot(
      "active_proofing_card",
      path.join(projectRoot, "data", "proofing_policy_db", "active_proofing_card.md"),
      input.includeProofingCard,
      "policy",
    ),
    sourceSnapshot(
      "active_longline",
      path.join(projectRoot, "data", "longline_db", "active_longline.md"),
      input.includeLongline,
      "reference",
    ),
  ]);
  const byLabel = Object.fromEntries(sourceList.map((source) => [source.label, source]));
  const allocated = allocateContent([
    {
      key: "active_engine_excerpt_or_reference",
      text: byLabel.active_engine.content,
      reference: byLabel.active_engine.path,
    },
    {
      key: "writing_card_excerpt_or_reference",
      text: byLabel.active_writing_card.content,
      reference: byLabel.active_writing_card.path,
    },
    {
      key: "proofing_card_excerpt_or_reference",
      text: byLabel.active_proofing_card.content,
      reference: byLabel.active_proofing_card.path,
    },
    {
      key: "longline_excerpt_or_reference",
      text: byLabel.active_longline.content,
      reference: byLabel.active_longline.path,
    },
    {
      key: "retrieval_context",
      text: serializeContext(input.retrievalContext),
      reference: "input.retrieval_context",
    },
    {
      key: "generation_context",
      text: serializeContext(input.generationContext),
      reference: "input.generation_context",
    },
  ], input.maxContextChars);
  const warnings = sourceList
    .filter((source) => source.included && source.exists === false)
    .map((source) => `Missing source: ${source.label}`);
  if (allocated.truncated_sections.length) {
    warnings.push(`Context truncated: ${allocated.truncated_sections.join(", ")}`);
  }
  for (const error of engineComponentValidationErrors) {
    warnings.push(`Engine component validation: ${error}`);
  }
  const publicSources = Object.fromEntries(sourceList.map(({ content, ...source }) => [
    source.label,
    source,
  ]));
  const bundle = {
    bundle_id: bundleId,
    bundle_kind: "gpt_writing_context",
    created_at: new Date().toISOString(),
    source: "gpt_writing_context_service",
    task_prompt: input.taskPrompt,
    chapter_mode: input.chapterMode,
    output_mode: input.outputMode,
    for_chat_output: true,
    engine_first: true,
    engine_id: engineComponentsStatus.engine_id,
    engine_components_status: engineComponentsStatus,
    engine_components_valid: engineComponentsStatus.ok === true,
    engine_component_validation_errors: engineComponentValidationErrors,
    neural_pipeline_required:
      engineComponentsStatus.components?.neural_pipeline?.required === true,
    required_neural_modules: requiredNeuralModules,
    governance_policy_required:
      engineComponentsStatus.components?.governance_policy?.required === true,
    local_generation_allowed: false,
    canon_update_allowed: false,
    approval_required_for_canon_change: true,
    active_engine_update_allowed: false,
    adoption_allowed: false,
    settlement_allowed: false,
    approval_required_for_any_canon_change: true,
    inputs: {
      generation_context: input.generationContext,
      retrieval_context: input.retrievalContext,
    },
    sources: publicSources,
    chat_instructions: {
      role: "GPT writes the candidate in chat",
      must_output_in_chat: true,
      do_not_update_canon: true,
      do_not_adopt: true,
      do_not_settle: true,
      if_cannot_continue: "only output stop reason",
    },
    content: {
      active_engine_excerpt_or_reference:
        allocated.content.active_engine_excerpt_or_reference,
      writing_card_excerpt_or_reference:
        allocated.content.writing_card_excerpt_or_reference,
      proofing_card_excerpt_or_reference:
        allocated.content.proofing_card_excerpt_or_reference,
      longline_excerpt_or_reference:
        allocated.content.longline_excerpt_or_reference,
      retrieval_context: input.retrievalContext,
      generation_context: input.generationContext,
      retrieval_context_for_chat: allocated.content.retrieval_context,
      generation_context_for_chat: allocated.content.generation_context,
    },
    context_chars_used: allocated.context_chars_used,
    max_context_chars: allocated.context_chars_limit,
    truncated_sections: allocated.truncated_sections,
    warnings,
  };
  const markdown = chatMarkdown(bundle);
  await commitFileTransaction("build-gpt-writing-context", [
    { filePath: paths.bundle, content: `${JSON.stringify(bundle, null, 2)}\n` },
    { filePath: paths.chat, content: markdown },
  ], { bundle_id: bundleId, phase: "phase_8b_gpt_writing_context" });
  return {
    bundle,
    context_bundle_path: normalizeProjectPath(paths.bundle),
    context_for_chat_path: normalizeProjectPath(paths.chat),
  };
}

export async function getGptWritingContextBundle(bundleId, options = {}) {
  const roots = rootsFor(options);
  const paths = bundlePaths(bundleId, roots);
  const [bundle, contextForChat] = await Promise.all([
    readFile(paths.bundle, "utf8").then(JSON.parse),
    readFile(paths.chat, "utf8"),
  ]);
  return {
    bundle,
    context_for_chat: contextForChat,
    context_bundle_path: normalizeProjectPath(paths.bundle),
    context_for_chat_path: normalizeProjectPath(paths.chat),
  };
}

export async function listGptWritingContextBundles(input = {}, options = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("input must be an object.");
  }
  const limit = optionalInteger(input.limit, 20, "limit", 100);
  const roots = rootsFor(options);
  await mkdir(roots.gptWritingContexts, { recursive: true });
  const entries = await readdir(roots.gptWritingContexts, { withFileTypes: true });
  const bundles = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !bundleIdPattern.test(entry.name)) continue;
    try {
      const record = await getGptWritingContextBundle(entry.name, options);
      bundles.push({
        bundle_id: entry.name,
        created_at: record.bundle.created_at,
        chapter_mode: record.bundle.chapter_mode,
        output_mode: record.bundle.output_mode,
        task_prompt: record.bundle.task_prompt,
        context_for_chat_path: record.context_for_chat_path,
        warnings: record.bundle.warnings,
      });
    } catch {
      // Ignore incomplete bundles.
    }
  }
  return bundles
    .sort((left, right) => String(right.created_at).localeCompare(String(left.created_at)))
    .slice(0, limit);
}
