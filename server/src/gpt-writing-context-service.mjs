import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { getEngineComponentsStatus } from "./engine-component-registry.mjs";
import { commitFileTransaction } from "./file-transactions.mjs";
import { buildWritingCardDirectorContext } from "./writing-card-director-service.mjs";
import { buildChapterAnchorFromBundle } from "./chapter-anchor-guard.mjs";
import {
  buildCharacterCanonGrounding,
  serializeCharacterCanonGroundingFixedGuard,
} from "./character-canon-grounding-service.mjs";
import {
  buildWorldEntityCanonGrounding,
  serializeWorldEntityCanonGroundingFixedGuard,
} from "./world-entity-canon-grounding-service.mjs";
import { createAgentRun, finalizeAgentRun } from "./agent-run-service.mjs";
import {
  run_scene_planner,
  run_character_simulator,
  run_neural_critic,
  run_style_drift_detector,
  run_over_governance_detector,
  run_writing_card_director,
} from "./neural-module-service.mjs";
import { summarizeNeuralUsageForRun } from "./neural-trace-service.mjs";
import {
  assertPathInside,
  normalizeProjectPath,
  projectPaths,
  projectRoot,
} from "./project-paths.mjs";
import {
  buildVisualUploadedReferencesWritingContextInjection,
  serializeVisualUploadedReferencesWritingContextMarkdown,
} from "./visual-uploaded-reference-writing-context-service.mjs";
import {
  buildLatestSettledContinuityTaskGuard,
  getLatestSettledContinuityOverlay,
  inspectCurrentInputSettlementFreshness,
  serializeLatestSettledContinuityFixedGuard,
  withLatestSettledContinuity,
} from "./latest-settled-continuity-service.mjs";
import {
  composeWritingContextSources,
  countActiveEngineRetrievalChars,
  truncateContextTextAtBlockBoundaries,
  truncateStructuredContextAtBoundaries,
} from "./context-composition-service.mjs";
import {
  formalWritingAuthorityContract,
} from "./formal-writing-contracts.mjs";
import {
  buildFormalRelevantCanon,
  countRelevantCanonActiveEngineChars,
} from "./formal-relevant-canon-service.mjs";
import {
  hydratePlannedEntityManifest,
} from "./canon-entity-hydration-service.mjs";
import {
  buildNeuralModuleContractRegistry,
} from "./neural-module-service.mjs";

const bundleIdPattern = /^gptctx_\d{8}-\d{6}-[a-f0-9]{8}$/u;
const chapterModes = new Set(["next_chapter", "specific_scene", "rewrite_candidate"]);
const outputModes = new Set(["chat_only", "candidate_save_later"]);
const taskPromptSources = new Set([
  "explicit_task_prompt",
  "old_generated_inputs",
]);
const defaultMaxContextChars = 48_000;
const maximumContextChars = 250_000;
const taskPromptMaxLength = 12_000;
const sectionBudgets = Object.freeze({
  task_prompt: 4_000,
  generation_context: 12_000,
  retrieval_context: 12_000,
  writing_card: 4_000,
  active_engine_retrieval: 12_000,
});

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
  const taskPromptSource = String(
    input.task_prompt_source
      ?? input.taskPromptSource
      ?? "explicit_task_prompt",
  ).trim();
  if (!chapterModes.has(chapterMode)) throw new Error(`Unknown chapter_mode: ${chapterMode}`);
  if (!outputModes.has(outputMode)) throw new Error(`Unknown output_mode: ${outputMode}`);
  if (!taskPromptSources.has(taskPromptSource)) {
    throw new Error(`Unknown task_prompt_source: ${taskPromptSource}`);
  }
  const ephemeral = optionalBoolean(
    input.ephemeral ?? input.dry_run ?? input.dryRun,
    false,
    "ephemeral",
  );
  const persistContext = optionalBoolean(
    input.persist_context ?? input.persistContext,
    true,
    "persist_context",
  );
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
    plannedEntityManifest: optionalObject(
      input.planned_entity_manifest ?? input.plannedEntityManifest,
      "planned_entity_manifest",
    ),
    taskPromptSource,
    chapterMode,
    outputMode,
    includeActiveEngine: optionalBoolean(
      input.include_active_engine ?? input.includeActiveEngine,
      false,
      "include_active_engine",
    ),
    includeWritingCard: optionalBoolean(
      input.include_writing_card ?? input.includeWritingCard,
      true,
      "include_writing_card",
    ),
    includeWritingCardDirector: optionalBoolean(
      input.include_writing_card_director ?? input.includeWritingCardDirector,
      true,
      "include_writing_card_director",
    ),
    includeProofingCard: optionalBoolean(
      input.include_proofing_card ?? input.includeProofingCard,
      false,
      "include_proofing_card",
    ),
    includeLongline: optionalBoolean(
      input.include_longline ?? input.includeLongline,
      true,
      "include_longline",
    ),
    includeVisualReferences: optionalBoolean(
      input.include_visual_references ?? input.includeVisualReferences,
      true,
      "include_visual_references",
    ),
    maxContextChars: optionalInteger(
      input.max_context_chars ?? input.maxContextChars,
      defaultMaxContextChars,
      "max_context_chars",
      maximumContextChars,
    ),
    // Opt-in: materialize neural traces when explicitly requested and adapter available.
    // The MCP schema may default both snake_case and camelCase aliases to false, so
    // treat either explicit true value as an opt-in while still validating both fields.
    runNeuralTraces: (
      optionalBoolean(input.run_neural_traces, false, "run_neural_traces")
      || optionalBoolean(input.runNeuralTraces, false, "runNeuralTraces")
    ),
    formalContextOnly: optionalBoolean(
      input.formal_context_only ?? input.formalContextOnly,
      false,
      "formal_context_only",
    ),
    ephemeral,
    persistContext: ephemeral ? false : persistContext,
  };
}

function rootsFor(options = {}) {
  if (options.fixtureRoot) {
    const fixtureRoot = assertPathInside(
      options.fixtureRoot,
      path.join(projectRoot, "tests", ".tmp"),
      "GPT writing context fixture root",
    );
    return { gptWritingContexts: path.join(fixtureRoot, "data", "outputs", "gpt_writing_contexts") };
  }
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

async function sourceSnapshot(
  label,
  filePath,
  included,
  canonStatus,
  { metadataWhenExcluded = false, authorityLevel = canonStatus } = {},
) {
  const sourcePath = normalizeProjectPath(filePath);
  if (!included && !metadataWhenExcluded) {
    return {
      label,
      path: sourcePath,
      included: false,
      text_included: false,
      exists: null,
      hash: null,
      modified_at: null,
      canon_status: canonStatus,
      authority_level: authorityLevel,
      content: "",
    };
  }
  try {
    const [content, fileStat] = await Promise.all([readFile(filePath, "utf8"), stat(filePath)]);
    return {
      label,
      path: sourcePath,
      included,
      text_included: included,
      exists: true,
      hash: sha256(content),
      modified_at: fileStat.mtime.toISOString(),
      canon_status: canonStatus,
      authority_level: authorityLevel,
      content: included ? content : "",
    };
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return {
      label,
      path: sourcePath,
      included,
      text_included: included,
      exists: false,
      hash: null,
      modified_at: null,
      canon_status: canonStatus,
      authority_level: authorityLevel,
      content: "",
    };
  }
}

function serializeContext(value) {
  return JSON.stringify(value, null, 2);
}

function taskPromptWithContinuityGuard(taskPrompt, guardText) {
  if (!guardText) {
    return {
      text: taskPrompt,
      guard_applied: false,
      original_task_prompt_truncated: false,
    };
  }

  const separator = "\n\n";
  const available = Math.max(
    0,
    taskPromptMaxLength
      - guardText.length
      - separator.length,
  );
  const boundedTaskPrompt = taskPrompt.slice(0, available);

  return {
    text: `${guardText}${separator}${boundedTaskPrompt}`,
    guard_applied: true,
    original_task_prompt_truncated:
      boundedTaskPrompt.length < taskPrompt.length,
  };
}

function withoutRedundantCreativeAuthorityLanguage(value) {
  return String(value ?? "")
    .replace(
      /[；;，,]?\s*只整理\s*Canon、entity、continuity\s*與權限契約[，,；;]?\s*不決定故事事件[。.]?/gu,
      "",
    )
    .replace(/[；;，,]?\s*不決定故事事件[。.]?/gu, "")
    .trim();
}

function characterVoiceRegistryMetadata(source) {
  return {
    loaded: source.exists === true,
    path: source.path,
    hash_sha256: source.hash,
    bytes: source.exists === true ? Buffer.byteLength(source.content, "utf8") : null,
    source_type: "read_only_derived_index",
    authority: "below_canon_db",
    usage: "supporting_voice_guidance_only",
    content_key: "character_voice_registry_content",
  };
}

function contextWithCharacterVoiceRegistry(context, metadata) {
  return {
    ...context,
    character_voice_registry: metadata,
  };
}

function disabledVisualUploadedReferencesContext() {
  return {
    schema_version: 1,
    phase: "39G",
    mode: "visual_uploaded_references_writing_context_injection_disabled",
    loaded: false,
    reference_count: 0,
    blocked_reference_count: 0,
    items: [],
    safety_contract: {
      visual_only: true,
      must_not_establish_canon: true,
      must_not_update_active_engine: true,
      must_not_update_canon_db: true,
    },
    decision: "visual_uploaded_references_writing_context_injection_disabled",
  };
}

function contextWithVisualUploadedReferences(context, packet) {
  return {
    ...context,
    visual_uploaded_references: {
      loaded: packet.loaded === true,
      reference_count: packet.reference_count ?? 0,
      injection_scope: packet.injection_scope ?? "writing_context_visual_only",
      canon_status: packet.canon_status ?? "reference_only",
      safety_contract: packet.safety_contract ?? {},
      items: packet.items ?? [],
    },
  };
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
    const sectionLimit = Math.max(
      0,
      Math.min(
        remaining,
        Number.isInteger(section.maxChars)
          ? section.maxChars
          : remaining,
      ),
    );
    const bounded = truncateContextTextAtBlockBoundaries(
      text,
      sectionLimit,
      section.key,
    );
    content[section.key] = bounded.text;
    remaining -= bounded.actual_chars;
    if (bounded.truncated) {
      truncation.push({
        source: section.key,
        reference: section.reference,
        truncated: true,
        original_chars: bounded.original_chars,
        actual_chars: bounded.actual_chars,
        budget_chars: bounded.budget_chars,
      });
    }
  }
  return {
    content,
    context_chars_used: maxChars - remaining,
    context_chars_limit: maxChars,
    truncated_sections: truncation.map((entry) => entry.source),
    truncated_sources: truncation,
  };
}

function serializedChars(value) {
  return JSON.stringify(value, null, 2).length;
}

function containsFullText(value, fullText, seen = new Set()) {
  const target = String(fullText ?? "").trim();
  if (!target) return false;
  if (typeof value === "string") return value.includes(target);
  if (!value || typeof value !== "object" || seen.has(value)) return false;
  seen.add(value);
  return Object.values(value).some((item) => (
    containsFullText(item, target, seen)
  ));
}

function buildBoundedFormalContext(bundle, maxChars) {
  const activeEngine = bundle.sources.active_engine ?? {};
  const authority = formalWritingAuthorityContract();
  const fixed = {
    context_kind: "formal_writing_context",
    source_priority: [
      "current_user_request",
      "latest_continuity_overlay",
      "current_active_engine_relevant_canon",
      "corroborated_stale_registry",
      "chatgpt_narrative_decisions",
      "external_reference_material",
      "old_generated_inputs",
    ],
    user_request: bundle.original_task_prompt ?? bundle.task_prompt,
    ...authority,
    active_engine_metadata: {
      path: activeEngine.path ?? null,
      sha256: activeEngine.hash ?? null,
      exists: activeEngine.exists === true,
      authority_level: activeEngine.authority_level ?? "active_hard_canon",
      full_text_included: false,
    },
    neural_module_contracts: buildNeuralModuleContractRegistry(),
  };
  const boundedRelevantCanon = truncateStructuredContextAtBoundaries(
    bundle.relevant_canon ?? {},
    Math.min(18_000, maxChars),
    "formal_context.materials.relevant_canon",
  );
  const continuityRecordIds = new Set(
    (boundedRelevantCanon.value?.continuity_facts ?? [])
      .map((record) => record.entity_id),
  );
  const unresolvedRecordIds = new Set(
    (boundedRelevantCanon.value?.current_status ?? [])
      .filter((record) => record.category === "unresolved_state")
      .map((record) => record.entity_id),
  );
  const materials = {
    retrieval_plan: bundle.retrieval_plan ?? {},
    planned_entity_manifest:
      bundle.planned_entity_manifest ?? {},
    planned_entity_hydration:
      bundle.planned_entity_hydration ?? {
        requested_entities: [],
        resolved_entities: [],
        unresolved_entities: [],
        canon_coverage_complete: true,
        character_count: 0,
      },
    planned_canon_coverage:
      bundle.planned_canon_coverage ?? {
        named_canon_entities: 0,
        hydrated_entities: 0,
        unresolved_entities: 0,
        coverage_complete: true,
      },
    relevant_canon: boundedRelevantCanon.value,
    continuity: {
      report_id:
        bundle.latest_settled_continuity?.report_id ?? null,
      continuity_head:
        bundle.latest_settled_continuity?.continuity_head ?? null,
      continuity_fact_ids: [...continuityRecordIds],
      unresolved_state_ids: [...unresolvedRecordIds],
      transition_suggestion_included: false,
    },
    chapter_anchor: {
      chapter:
        bundle.latest_settled_continuity?.chapter
        ?? bundle.content.chapter_anchor?.chapter
        ?? "unknown",
      display_heading:
        bundle.latest_settled_continuity?.display_heading ?? null,
      continuity_head:
        bundle.latest_settled_continuity?.continuity_head ?? null,
      requested_topics: [
        ...(bundle.retrieval_plan?.characters ?? []),
        ...(bundle.retrieval_plan?.status_effects ?? []),
        ...(bundle.retrieval_plan?.world_rules ?? []),
      ],
    },
    generation_context: bundle.inputs.generation_context ?? {},
    retrieval_context: bundle.inputs.retrieval_context ?? {},
    writing_card_director:
      bundle.content.writing_card_director_context ?? null,
  };
  let materialBudget = Math.max(
    2,
    maxChars - serializedChars(fixed) - 512,
  );
  let boundedMaterials;
  let formalContext;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    boundedMaterials = truncateStructuredContextAtBoundaries(
      materials,
      materialBudget,
      "formal_context.materials",
    );
    formalContext = {
      ...fixed,
      materials: boundedMaterials.value,
    };
    const overflow = serializedChars(formalContext) - maxChars;
    if (overflow <= 0) break;
    materialBudget = Math.max(2, materialBudget - overflow - 32);
  }
  if (serializedChars(formalContext) > maxChars) {
    const fallback = truncateStructuredContextAtBoundaries(
      formalContext,
      maxChars,
      "formal_context",
    );
    return {
      value: fallback.value,
      text: fallback.text,
      actual_chars: fallback.actual_chars,
      truncated: true,
      truncated_paths: fallback.truncated_paths,
    };
  }
  return {
    value: formalContext,
    text: JSON.stringify(formalContext, null, 2),
    actual_chars: serializedChars(formalContext),
    truncated:
      boundedRelevantCanon.truncated
      || boundedMaterials.truncated,
    truncated_paths: [
      ...boundedRelevantCanon.truncated_paths,
      ...boundedMaterials.truncated_paths,
    ],
  };
}

function chatMarkdown(bundle) {
  if (bundle.formal_context) {
    return [
      "# GPT Formal Writing Context",
      "",
      "```json",
      JSON.stringify(bundle.formal_context, null, 2),
      "```",
      "",
    ].join("\n");
  }
  const sourceLines = Object.values(bundle.sources).map((source) => (
    `- ${source.label}: included=${source.included}, exists=${source.exists}, hash=${source.hash ?? "none"}, path=${source.path}`
  ));
  const engineStatus = bundle.engine_components_status;
  const requiredNeuralModules = bundle.required_neural_modules
    .map((moduleName) => `  - ${moduleName}`);
  const writingCardDirectorPresent = bundle.content && bundle.content.writing_card_director_context ? "present" : "absent";
  const visualUploadedReferences = bundle.visual_uploaded_references ?? { loaded: false, reference_count: 0 };
  return [
    "# GPT Writing Context Bundle",
    "",
    // Fixed guard section must be placed before task prompt to avoid truncation
    ...(bundle.fixed_guard_section ? [bundle.fixed_guard_section, ""] : []),
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
    `- writing_card_director_context：${writingCardDirectorPresent}`,
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
    "## Character Voice Registry (Supporting Guidance Only)",
    "",
    `- loaded: ${bundle.character_voice_registry_loaded}`,
    `- source type: ${bundle.character_voice_registry_source_type}`,
    `- authority: ${bundle.character_voice_registry_authority}`,
    `- path: ${bundle.character_voice_registry_path}`,
    `- SHA-256: ${bundle.character_voice_registry_hash_sha256 ?? "none"}`,
    "",
    bundle.content.character_voice_registry_content || "[missing]",
    "",
    "## Visual Uploaded References (Visual-only)",
    "",
    `- loaded: ${visualUploadedReferences.loaded === true}`,
    `- reference count: ${visualUploadedReferences.reference_count ?? 0}`,
    `- injection scope: ${visualUploadedReferences.injection_scope ?? "writing_context_visual_only"}`,
    "- authority: below canon; visual reference only",
    "- usage: appearance, pose, style, and atmosphere guidance only",
    "- forbidden: canon facts, ability mechanics, soul weapons, relationships, ranks, factions, timeline events, chapter outcomes",
    "- active_engine update permission: none",
    "- canon update permission: none",
    "",
    bundle.content.visual_uploaded_reference_context || "[missing]",
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
  if (input.persistContext) {
    await mkdir(roots.gptWritingContexts, { recursive: true });
  }
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
  const characterVoiceRegistryPath = options.characterVoiceRegistryPath
    ? assertPathInside(
      options.characterVoiceRegistryPath,
      projectPaths.characterProfileDb,
      "character voice registry test path",
    )
    : projectPaths.characterVoiceRegistry;
  const latestSettledContinuity =
    await getLatestSettledContinuityOverlay(options);
  const currentInputSettlementFreshness =
    await inspectCurrentInputSettlementFreshness(
      latestSettledContinuity,
      options,
    );
  const continuityTaskGuard =
    buildLatestSettledContinuityTaskGuard(
      latestSettledContinuity,
      currentInputSettlementFreshness,
    );
  const formalTaskPrompt = input.formalContextOnly
    ? withoutRedundantCreativeAuthorityLanguage(input.taskPrompt)
    : input.taskPrompt;
  const effectiveTaskPrompt =
    taskPromptWithContinuityGuard(
      formalTaskPrompt,
      continuityTaskGuard,
    );
  const sourceList = await Promise.all([
    sourceSnapshot(
      "active_engine",
      activeEnginePath,
      input.includeActiveEngine,
      "active",
      {
        metadataWhenExcluded: true,
        authorityLevel: "active_hard_canon",
      },
    ),
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
    sourceSnapshot(
      "character_voice_registry",
      characterVoiceRegistryPath,
      true,
      "read_only_derived_index",
    ),
    sourceSnapshot(
      "visual_index",
      projectPaths.visualIndex,
      input.includeVisualReferences,
      "visual_only_reference",
    ),
  ]);
  const byLabel = Object.fromEntries(sourceList.map((source) => [source.label, source]));
  const groundingActiveEngine = byLabel.active_engine.included
    ? byLabel.active_engine
    : await sourceSnapshot(
      "character_canon_grounding_active_engine",
      activeEnginePath,
      true,
      "active",
    );
  const formalRelevantCanon = await buildFormalRelevantCanon({
    taskPrompt: formalTaskPrompt,
    generationContext: input.generationContext,
    retrievalContext: input.retrievalContext,
    latestContinuity: latestSettledContinuity,
    activeEngineContent: groundingActiveEngine.content,
    activeEnginePath: groundingActiveEngine.path,
    activeEngineHash: groundingActiveEngine.hash,
  }, options);
  const plannedEntityHydration = await hydratePlannedEntityManifest({
    plannedEntityManifest: input.plannedEntityManifest,
    relevantCanon: formalRelevantCanon.relevant_canon,
    activeEngineContent: groundingActiveEngine.content,
    activeEnginePath: groundingActiveEngine.path,
    activeEngineHash: groundingActiveEngine.hash,
  }, options);
  formalRelevantCanon.relevant_canon =
    plannedEntityHydration.relevant_canon;
  const characterCanonGrounding = buildCharacterCanonGrounding({
    activeEngineContent: groundingActiveEngine.content,
    sourceFile: groundingActiveEngine.path,
    taskPrompt: effectiveTaskPrompt.text,
    generationContext: input.generationContext,
    retrievalContext: input.retrievalContext,
    currentLongline: byLabel.active_longline.content,
    explicitCharacterNames:
      formalRelevantCanon.retrieval_plan.characters,
  });
  const worldEntityCanonGrounding = buildWorldEntityCanonGrounding({
    activeEngineContent: groundingActiveEngine.content,
    sourceFile: groundingActiveEngine.path,
    taskPrompt: effectiveTaskPrompt.text,
    generationContext: input.generationContext,
    retrievalContext: input.retrievalContext,
    currentLongline: byLabel.active_longline.content,
  });
  const characterVoiceRegistry = characterVoiceRegistryMetadata(
    byLabel.character_voice_registry,
  );
  const visualUploadedReferences = input.includeVisualReferences
    ? await buildVisualUploadedReferencesWritingContextInjection(
      options.visualUploadedReferencesOptions ?? {},
    )
    : disabledVisualUploadedReferencesContext();
  const rawGenerationContext = contextWithVisualUploadedReferences(
    contextWithCharacterVoiceRegistry(
      withLatestSettledContinuity(
        input.generationContext,
        latestSettledContinuity,
      ),
      characterVoiceRegistry,
    ),
    visualUploadedReferences,
  );
  const rawRetrievalContext = contextWithVisualUploadedReferences(
    contextWithCharacterVoiceRegistry(
      withLatestSettledContinuity(
        input.retrievalContext,
        latestSettledContinuity,
      ),
      characterVoiceRegistry,
    ),
    visualUploadedReferences,
  );
  const composed = composeWritingContextSources({
    taskPrompt: effectiveTaskPrompt.text,
    taskPromptSource: input.taskPromptSource,
    continuityOverlay:
      latestSettledContinuity.loaded === true
        ? latestSettledContinuity.summary_text
        : "",
    generationContext: rawGenerationContext,
    retrievalContext: rawRetrievalContext,
  });
  const boundedTaskPrompt = truncateContextTextAtBlockBoundaries(
    composed.task_prompt,
    Math.min(sectionBudgets.task_prompt, input.maxContextChars),
    "task_prompt",
  );
  const remainingAfterTask = Math.max(
    0,
    input.maxContextChars - boundedTaskPrompt.actual_chars,
  );
  const boundedGenerationContext = truncateStructuredContextAtBoundaries(
    composed.generation_context,
    Math.min(
      sectionBudgets.generation_context,
      remainingAfterTask,
    ),
    "generation_context",
  );
  const remainingAfterGeneration = Math.max(
    0,
    remainingAfterTask
      - boundedGenerationContext.actual_chars,
  );
  const boundedRetrievalContext = truncateStructuredContextAtBoundaries(
    composed.retrieval_context,
    Math.min(
      sectionBudgets.retrieval_context,
      remainingAfterGeneration,
    ),
    "retrieval_context",
  );
  const generationContext = boundedGenerationContext.value;
  const retrievalContext = boundedRetrievalContext.value;
  const composedLatestSettledContinuity =
    latestSettledContinuity.loaded === true
      ? {
        ...latestSettledContinuity,
        summary_text: composed.continuity_overlay,
      }
      : latestSettledContinuity;
  const remainingContentBudget = Math.max(
    0,
    input.maxContextChars
      - boundedTaskPrompt.actual_chars
      - boundedGenerationContext.actual_chars
      - boundedRetrievalContext.actual_chars,
  );
  const allocated = allocateContent([
    {
      key: "writing_card_excerpt_or_reference",
      text: byLabel.active_writing_card.content,
      reference: byLabel.active_writing_card.path,
      maxChars: sectionBudgets.writing_card,
    },
    {
      key: "active_engine_excerpt_or_reference",
      text: byLabel.active_engine.content,
      reference: byLabel.active_engine.path,
    },
    {
      key: "longline_excerpt_or_reference",
      text: byLabel.active_longline.content,
      reference: byLabel.active_longline.path,
    },
    {
      key: "character_voice_registry_content",
      text: byLabel.character_voice_registry.content,
      reference: byLabel.character_voice_registry.path,
    },
    {
      key: "visual_uploaded_reference_context",
      text: serializeVisualUploadedReferencesWritingContextMarkdown(visualUploadedReferences),
      reference: byLabel.visual_index.path,
    },
    {
      key: "proofing_card_excerpt_or_reference",
      text: byLabel.active_proofing_card.content,
      reference: byLabel.active_proofing_card.path,
      maxChars: sectionBudgets.writing_card,
    },
  ], remainingContentBudget);
  allocated.content.retrieval_context = boundedRetrievalContext.text;
  allocated.content.generation_context = boundedGenerationContext.text;
  const warnings = sourceList
    .filter((source) => source.included && source.exists === false)
    .map((source) => `Missing source: ${source.label}`);
  warnings.push(...(
    latestSettledContinuity.warnings ?? []
  ));
  if (
    currentInputSettlementFreshness
      .stale_due_to_newer_settlement === true
  ) {
    warnings.push(
      "Generated current inputs are stale because a newer chapter settlement exists.",
    );
  }
  if (effectiveTaskPrompt.original_task_prompt_truncated) {
    warnings.push(
      "Original task prompt was truncated after the latest settled continuity guard was applied.",
    );
  }
  const boundedInputTruncation = [
    boundedTaskPrompt,
    boundedGenerationContext,
    boundedRetrievalContext,
  ].filter((entry) => entry.truncated).map((entry) => ({
    source: entry.source,
    truncated: true,
    original_chars: entry.original_chars,
    actual_chars: entry.actual_chars,
    budget_chars: entry.budget_chars,
    ...(entry.truncated_paths?.length
      ? { truncated_paths: entry.truncated_paths }
      : {}),
  }));
  const truncatedSources = [
    ...boundedInputTruncation,
    ...allocated.truncated_sources,
  ];
  if (allocated.truncated_sections.length) {
    warnings.push(`Context truncated: ${allocated.truncated_sections.join(", ")}`);
  }
  if (boundedInputTruncation.length) {
    warnings.push(
      `Context sections truncated at block boundaries: ${boundedInputTruncation.map((entry) => entry.source).join(", ")}`,
    );
  }
  for (const error of engineComponentValidationErrors) {
    warnings.push(`Engine component validation: ${error}`);
  }
  const publicSources = Object.fromEntries(sourceList.map(({ content, ...source }) => [
    source.label,
    source,
  ]));
  publicSources.latest_settled_continuity = {
    label: "latest_settled_continuity",
    path: latestSettledContinuity.content_path ?? null,
    included: latestSettledContinuity.loaded === true,
    exists: latestSettledContinuity.loaded === true,
    hash: latestSettledContinuity.settlement_report_hash ?? null,
    modified_at: latestSettledContinuity.created_at ?? null,
    canon_status: latestSettledContinuity.canon_status
      ?? "settlement_report_only",
    authority: latestSettledContinuity.authority ?? null,
  };
  const bundle = {
    bundle_id: bundleId,
    bundle_kind: "gpt_writing_context",
    created_at: new Date().toISOString(),
    source: "gpt_writing_context_service",
    task_prompt: boundedTaskPrompt.text,
    original_task_prompt: formalTaskPrompt,
    latest_settled_continuity_task_guard_applied:
      effectiveTaskPrompt.guard_applied,
    latest_settled_continuity: composedLatestSettledContinuity,
    current_input_settlement_freshness:
      currentInputSettlementFreshness,
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
    character_voice_registry_loaded: characterVoiceRegistry.loaded,
    character_voice_registry_path: characterVoiceRegistry.path,
    character_voice_registry_hash_sha256: characterVoiceRegistry.hash_sha256,
    character_voice_registry_bytes: characterVoiceRegistry.bytes,
    character_voice_registry_source_type: characterVoiceRegistry.source_type,
    character_voice_registry_authority: characterVoiceRegistry.authority,
    character_canon_grounding_loaded: characterCanonGrounding.loaded,
    character_canon_grounding_count: characterCanonGrounding.matched_character_count,
    character_canon_grounding_source_authority: characterCanonGrounding.source_authority,
    character_canon_grounding_source_file: characterCanonGrounding.source_file,
    world_entity_canon_grounding_loaded: worldEntityCanonGrounding.loaded,
    world_entity_canon_grounding_count:
      worldEntityCanonGrounding.matched_world_entity_count,
    world_entity_canon_grounding_source_authority:
      worldEntityCanonGrounding.source_authority,
    world_entity_canon_grounding_source_file:
      worldEntityCanonGrounding.source_file,
    visual_uploaded_references_loaded: visualUploadedReferences.loaded === true,
    visual_uploaded_references_path: visualUploadedReferences.visual_index_path ?? byLabel.visual_index.path,
    visual_uploaded_references_hash_sha256: visualUploadedReferences.visual_index_hash_sha256 ?? byLabel.visual_index.hash,
    visual_uploaded_references_count: visualUploadedReferences.reference_count ?? 0,
    visual_uploaded_references: visualUploadedReferences,
    retrieval_plan: formalRelevantCanon.retrieval_plan,
    relevant_canon: formalRelevantCanon.relevant_canon,
    planned_entity_manifest:
      plannedEntityHydration.planned_entity_manifest,
    planned_entity_hydration:
      plannedEntityHydration.planned_entity_hydration,
    planned_canon_coverage:
      plannedEntityHydration.planned_canon_coverage,
    continuity_sections: {
      continuity_facts:
        formalRelevantCanon.continuity.continuity_facts,
      unresolved_state:
        formalRelevantCanon.continuity.unresolved_state,
      transition_suggestion_included: false,
    },
    inputs: {
      generation_context: generationContext,
      retrieval_context: retrievalContext,
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
      character_voice_registry_content:
        allocated.content.character_voice_registry_content,
      character_canon_grounding: characterCanonGrounding,
      world_entity_canon_grounding: worldEntityCanonGrounding,
      visual_uploaded_reference_context:
        allocated.content.visual_uploaded_reference_context,
      latest_settled_continuity:
        composedLatestSettledContinuity.loaded === true
          ? composedLatestSettledContinuity
          : null,
      retrieval_context: retrievalContext,
      generation_context: generationContext,
      retrieval_context_for_chat: allocated.content.retrieval_context,
      generation_context_for_chat: allocated.content.generation_context,
      writing_card_director_context: null,
    },
    context_chars_used:
      boundedTaskPrompt.actual_chars
      + boundedGenerationContext.actual_chars
      + boundedRetrievalContext.actual_chars
      + allocated.context_chars_used,
    max_context_chars: input.maxContextChars,
    truncated_sections: truncatedSources.map((entry) => entry.source),
    context_composition: {
      ...composed.metadata,
      task_prompt_chars: boundedTaskPrompt.actual_chars,
      generation_context_chars: boundedGenerationContext.actual_chars,
      retrieval_context_chars: boundedRetrievalContext.actual_chars,
      active_engine_full_text_included:
        input.includeActiveEngine === true
        && byLabel.active_engine.exists === true
        && !allocated.truncated_sources.some(
          (entry) => entry.source === "active_engine_excerpt_or_reference",
        ),
      active_engine_text_requested: input.includeActiveEngine === true,
      active_engine_retrieval_chars: Math.min(
        sectionBudgets.active_engine_retrieval,
        formalRelevantCanon.relevant_canon
          .active_engine_retrieval_chars
          ?? countActiveEngineRetrievalChars(retrievalContext),
      ),
      proofing_card_included:
        Boolean(allocated.content.proofing_card_excerpt_or_reference),
      writing_card_included:
        Boolean(allocated.content.writing_card_excerpt_or_reference),
      longline_included:
        Boolean(allocated.content.longline_excerpt_or_reference),
      truncated_sources: truncatedSources,
      duplicate_sources: composed.metadata.duplicate_sources,
      total_chars_after_budget:
        boundedTaskPrompt.actual_chars
        + boundedGenerationContext.actual_chars
        + boundedRetrievalContext.actual_chars
        + allocated.context_chars_used,
      section_budgets: { ...sectionBudgets },
      relevant_canon_chars:
        serializedChars(formalRelevantCanon.relevant_canon),
      relevant_canon_budget_chars: 18_000,
      planned_entity_hydration_chars:
        plannedEntityHydration.composition
          .planned_entity_hydration_chars,
      planned_canon_coverage:
        plannedEntityHydration.planned_canon_coverage,
      transition_suggestion_included: false,
    },
    warnings,
    persistence: {
      persisted: input.persistContext,
      ephemeral: input.ephemeral,
      writing_context_record_created: input.persistContext,
    },
  };
  bundle.fixed_guard_section = [
    serializeLatestSettledContinuityFixedGuard(
      composedLatestSettledContinuity,
      currentInputSettlementFreshness,
    ),
    serializeCharacterCanonGroundingFixedGuard(
      characterCanonGrounding,
    ),
    serializeWorldEntityCanonGroundingFixedGuard(
      worldEntityCanonGrounding,
    ),
  ].filter(Boolean).join("\n\n");
  // Attach deterministic writing card director context (local only)
  if (input.includeWritingCardDirector) {
    try {
      const director = buildWritingCardDirectorContext({
        taskPrompt: bundle.task_prompt,
        generationContext,
        retrievalContext,
        writingCardText: byLabel.active_writing_card.content,
      });
      bundle.content.writing_card_director_context = director;
    } catch (error) {
      bundle.warnings.push(`Writing card director generation failed: ${error.message}`);
    }
  }

  // Attach chapter anchor guard (fixed guard section)
  try {
    const anchor = buildChapterAnchorFromBundle(bundle);
    // attach into bundle content
    bundle.content.chapter_anchor = anchor.chapter_anchor;
    bundle.anchor_confidence = anchor.anchor_confidence;
    bundle.guard_severity = anchor.guard_severity;
    bundle.compact_entity_anchor = anchor.compact_entity_anchor;
    // prepare a fixed guard section to place at top of chat markdown
    const guardLines = [
      "## 【P0｜本章錨點鎖】",
      "",
      "```json",
      JSON.stringify(anchor.chapter_anchor, null, 2),
      "```",
      "",
      "## 【P0｜已成立事實保護與原創自由】",
      "",
      "- 已成立的 Canon、因果與章節錨點必須保持；這些來源保護既有事實，不是允許存在的角色或世界 entity 白名單。",
      "- GPT 可依長篇發展自由創造新角色、國家、地區、城市、行政機關、學校、組織、企業、派系與設施。",
      "- Canon 查無資料本身不是錯誤、越界或停止生成理由，也不要求刪除新 entity。",
      "- 只有高可信度對應既有 Canon entity 時才套用其 hard facts；名稱碰撞或身分不明時保持 unresolved。",
      "- 原創 entity 不會因出現在正文而自動寫入 Canon、candidate、adoption、activation 或 settlement workflow。",
      "",
    ].join("\n");
    bundle.fixed_guard_section = [bundle.fixed_guard_section, guardLines]
      .filter(Boolean)
      .join("\n\n");
  } catch (err) {
    bundle.warnings.push(`chapter_anchor_generation_failed: ${err.message}`);
  }
  // Optionally materialize neural traces into the bundle when explicitly requested.
  if (input.runNeuralTraces === true) {
    try {
      // derive required trace modules (strip wrapper prefix)
      const requiredWrappers = bundle.required_neural_modules ?? [];
      const requiredTraceModules = requiredWrappers.map((w) => (
        String(w ?? "").startsWith("run_") ? String(w).slice(4) : String(w)
      )).filter(Boolean);
      // Exclude post-generation modules from pre-generation trace materialization
      const preGenerationModules = new Set([
        "scene_planner",
        "character_simulator",
        "neural_critic",
        "style_drift_detector",
        "over_governance_detector",
        "writing_card_director",
      ]);
      const filteredRequiredTraceModules = requiredTraceModules.filter((m) => preGenerationModules.has(m));
      if (filteredRequiredTraceModules.length > 0) {
        // create an agent run to record traces
        const agentRunOptions = options.fixtureRoot ? { fixtureRoot: options.fixtureRoot } : {};
        const agentRun = await createAgentRun({
          requires_neural_modules: true,
          required_neural_modules: requiredTraceModules,
          task_type: "draft_generation",
          created_by: "gpt_writing_context_service",
        }, agentRunOptions);
        const runId = agentRun.run_id;
        // adapter resolution: options.neuralAdapter or options.neuralAdapters[module]
        const adapters = options.neuralAdapters ?? null;
        const globalAdapter = options.neuralAdapter ?? options.neural_adapter ?? null;
        const wrapperByName = {
          scene_planner: run_scene_planner,
          character_simulator: run_character_simulator,
          neural_critic: run_neural_critic,
          style_drift_detector: run_style_drift_detector,
          over_governance_detector: run_over_governance_detector,
          writing_card_director: run_writing_card_director,
        };
        for (const moduleName of filteredRequiredTraceModules) {
          const wrapper = wrapperByName[moduleName];
          const adapter = (adapters && adapters[moduleName]) ? adapters[moduleName] : globalAdapter;
          // call wrapper; if adapter is null the wrapper will record a skipped trace
          try {
            await wrapper({
              task_prompt: bundle.task_prompt,
              generation_context: generationContext,
              retrieval_context: retrievalContext,
              character_voice_registry: characterVoiceRegistry,
              character_canon_grounding: characterCanonGrounding,
              world_entity_canon_grounding: worldEntityCanonGrounding,
            }, { run_id: runId, task_type: "draft_generation", adapter, ...agentRunOptions });
          } catch (err) {
            // record but do not block bundle creation
            bundle.warnings.push(`neural_wrapper_failed:${moduleName}:${err.message}`);
          }
        }
        // finalize run (verifies modules and writes warnings)
        try {
          await finalizeAgentRun(runId, agentRunOptions);
        } catch (err) {
          // non-fatal
          bundle.warnings.push(`finalize_agent_run_failed:${err.message}`);
        }
        // summarize usage and attach into bundle
        try {
          const summary = await summarizeNeuralUsageForRun(runId, agentRunOptions);
          bundle.neural_modules_used = summary.neural_modules_used ?? [];
          bundle.neural_traces = (summary.traces ?? []).map((t) => ({
            trace_id: t.trace_id,
            module_name: t.module_name,
            status: t.status,
            called_at: t.called_at,
            latency_ms: t.latency_ms,
          }));
          bundle.neural_trace_complete = (summary.missing_required_neural_modules ?? []).length === 0;
          bundle.neural_trace_warnings = summary.warnings ?? [];
          if (summary.missing_required_neural_modules && summary.missing_required_neural_modules.length) {
            bundle.warnings.push("missing_required_neural_modules");
          }
        } catch (err) {
          bundle.warnings.push(`summarize_neural_usage_failed:${err.message}`);
        }
      }
    } catch (err) {
      bundle.warnings.push(`neural_trace_materialization_failed: ${err.message}`);
    }
  }

  const boundedFormalContext = buildBoundedFormalContext(
    bundle,
    input.maxContextChars,
  );
  bundle.formal_context = boundedFormalContext.value;
  bundle.context_composition.formal_context_only =
    input.formalContextOnly;
  if (input.formalContextOnly) {
    bundle.context_chars_used = boundedFormalContext.actual_chars;
    bundle.context_composition.total_chars_after_budget =
      boundedFormalContext.actual_chars;
    bundle.context_composition.active_engine_full_text_included =
      containsFullText(
        bundle.formal_context,
        groundingActiveEngine.content,
      );
    bundle.context_composition.active_engine_retrieval_chars =
      countRelevantCanonActiveEngineChars(
        bundle.formal_context?.materials?.relevant_canon ?? {},
      );
    bundle.context_composition.relevant_canon_chars =
      serializedChars(
        bundle.formal_context?.materials?.relevant_canon ?? {},
      );
    bundle.context_composition.planned_entity_hydration_chars =
      serializedChars(
        bundle.formal_context?.materials?.planned_entity_hydration
        ?? {},
      );
    bundle.context_composition.planned_canon_coverage =
      bundle.formal_context?.materials?.planned_canon_coverage
      ?? null;
    bundle.context_composition.proofing_card_included =
      containsFullText(
        bundle.formal_context,
        byLabel.active_proofing_card.content,
      );
  } else {
    bundle.context_composition.active_engine_full_text_included =
      containsFullText(
        bundle.content,
        groundingActiveEngine.content,
      );
  }
  bundle.context_composition.formal_context_truncated =
    boundedFormalContext.truncated;
  bundle.context_composition.formal_context_truncated_paths =
    boundedFormalContext.truncated_paths;
  if (boundedFormalContext.truncated) {
    bundle.truncated_sections = [
      ...new Set([
        ...bundle.truncated_sections,
        "formal_context",
      ]),
    ];
  }

  const markdown = chatMarkdown(bundle);
  if (input.persistContext) {
    await commitFileTransaction("build-gpt-writing-context", [
      { filePath: paths.bundle, content: `${JSON.stringify(bundle, null, 2)}\n` },
      { filePath: paths.chat, content: markdown },
    ], {
      bundle_id: bundleId,
      phase: "phase_8b_gpt_writing_context",
      ...(options.fixtureRoot ? {
        test_transaction_dir: path.join(options.fixtureRoot, "data", "outputs", "logs", "transactions"),
      } : {}),
    });
  }
  return {
    bundle,
    context_bundle_path: input.persistContext
      ? normalizeProjectPath(paths.bundle)
      : null,
    context_for_chat_path: input.persistContext
      ? normalizeProjectPath(paths.chat)
      : null,
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
