import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import {
  buildAdoptedWritingSettlementContext,
  saveChatOutputAsSettlementReport,
} from "./adopted-writing-settlement-service.mjs";
import { requestWritingCandidateAdoption } from "./candidate-adoption-request-service.mjs";
import { buildCandidateProofingContext } from "./candidate-proofing-context-service.mjs";
import { saveChatOutputAsProofReport } from "./candidate-proof-report-service.mjs";
import { saveChatOutputAsWritingCandidate } from "./chat-output-candidate-service.mjs";
import { buildGptWritingContext } from "./gpt-writing-context-service.mjs";
import { runFullRecursiveWritingPipeline } from "./full-recursive-writing-pipeline-service.mjs";
import {
  assertPathInside,
  normalizeProjectPath,
  projectPaths,
  projectRoot,
} from "./project-paths.mjs";
import { commitFileTransaction } from "./file-transactions.mjs";

const defaultMaxChars = 120_000;
const maximumMaxChars = 250_000;

export const chatgptBridgeSafety = Object.freeze({
  bridge_phase: "phase_14a_lite",
  can_generate_locally: false,
  can_call_external_llm: false,
  can_modify_active_engine: false,
  can_modify_compressed_rules: false,
  can_apply_compressed_rules: false,
  can_activate_engine: false,
  can_approve: false,
  can_confirm_adoption: false,
  can_restore: false,
  can_rollback: false,
  can_execute_cleanup: false,
});

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function optionalBoolean(value, fallback, label) {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "boolean") throw new Error(`${label} must be a boolean.`);
  return value;
}

function optionalInteger(value, fallback, label) {
  if (value === undefined || value === null) return fallback;
  if (!Number.isInteger(value) || value < 1 || value > maximumMaxChars) {
    throw new Error(`${label} must be an integer between 1 and ${maximumMaxChars}.`);
  }
  return value;
}

function boundTaskPromptFromSnapshot(snapshot, maxAllowed = 12000) {
  const meta = {
    original_task_prompt_chars: 0,
    task_prompt_chars_used: 0,
    task_prompt_truncated: false,
    task_prompt_source_path: null,
    task_prompt_source_sha256: null,
  };
  if (!snapshot || typeof snapshot.text !== "string") return { bounded: "", meta };
  const text = snapshot.text;
  meta.original_task_prompt_chars = Array.from(text).length;
  meta.task_prompt_source_path = snapshot.path ?? null;
  meta.task_prompt_source_sha256 = snapshot.sha256 ?? null;
  if (meta.original_task_prompt_chars <= maxAllowed) {
    meta.task_prompt_chars_used = meta.original_task_prompt_chars;
    return { bounded: text, meta };
  }
  // Bound by taking head portion and reserving room for the truncation marker.
  meta.task_prompt_truncated = true;
  const marker = `\n\n[truncated: original_chars=${meta.original_task_prompt_chars}]`;
  const markerChars = Array.from(marker).length;
  const headLimit = Math.max(0, maxAllowed - markerChars);
  const truncated = Array.from(text).slice(0, headLimit).join("");
  const compacted = `${truncated}${marker}`;
  meta.task_prompt_chars_used = Array.from(compacted).length;
  return { bounded: compacted, meta };
}

function rootOption(options, key, fallback, allowedRoot = projectPaths.outputs) {
  return options[key]
    ? assertPathInside(options[key], allowedRoot, `${key} test root`)
    : fallback;
}

function bridgeRoots(options = {}) {
  return {
    gptWritingContexts: rootOption(
      options,
      "gptWritingContexts",
      projectPaths.gptWritingContexts,
    ),
    writingCandidates: rootOption(
      options,
      "writingCandidates",
      projectPaths.writingCandidates,
    ),
    proofingContexts: rootOption(
      options,
      "proofingContexts",
      projectPaths.proofingContexts,
    ),
    proofReports: rootOption(options, "proofReports", projectPaths.proofReports),
    approvalQueue: rootOption(
      options,
      "approvalQueue",
      projectPaths.approvalQueue,
      projectPaths.approvalQueue,
    ),
    adoptedWritings: rootOption(
      options,
      "adoptedWritings",
      projectPaths.adoptedWritings,
    ),
    settlementContexts: rootOption(
      options,
      "settlementContexts",
      projectPaths.adoptedWritingSettlementContexts,
    ),
    settlementReports: rootOption(
      options,
      "settlementReports",
      projectPaths.adoptedWritingSettlementReports,
    ),
  };
}

async function fileSnapshot(filePath, includeText, maxChars) {
  try {
    const [content, fileStat] = await Promise.all([
      readFile(filePath, "utf8"),
      stat(filePath),
    ]);
    const truncated = content.length > maxChars;
    return {
      path: normalizeProjectPath(filePath),
      exists: true,
      chars: content.length,
      sha256: sha256(content),
      modified_at: fileStat.mtime.toISOString(),
      text: includeText ? content.slice(0, maxChars) : undefined,
      truncated: includeText && truncated,
    };
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return {
      path: normalizeProjectPath(filePath),
      exists: false,
      chars: 0,
      sha256: null,
      modified_at: null,
      text: includeText ? "" : undefined,
      truncated: false,
    };
  }
}

async function countEntries(directory, pattern = null) {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    return entries.filter((entry) => (
      (entry.isDirectory() || entry.isFile()) && (!pattern || pattern.test(entry.name))
    )).length;
  } catch (error) {
    if (error.code === "ENOENT") return 0;
    throw error;
  }
}

export async function getChatgptBridgeWorkbenchStatus(options = {}) {
  const roots = bridgeRoots(options);
  const activeEnginePath = options.activeEnginePath
    ? assertPathInside(options.activeEnginePath, projectPaths.canonDb, "active engine test path")
    : projectPaths.activeEngine;
  const compressedRulesPath = options.compressedRulesPath
    ? assertPathInside(
      options.compressedRulesPath,
      projectPaths.errorReportDb,
      "compressed rules test path",
    )
    : projectPaths.compressedRules;
  const [activeEngine, compressedRules, counts] = await Promise.all([
    fileSnapshot(activeEnginePath, false, 1),
    fileSnapshot(compressedRulesPath, false, 1),
    Promise.all([
      countEntries(roots.gptWritingContexts, /^gptctx_/u),
      countEntries(roots.writingCandidates, /^writing_candidate_/u),
      countEntries(roots.proofingContexts, /^proofctx_/u),
      countEntries(roots.proofReports, /^proof_report_/u),
      countEntries(roots.approvalQueue, /\.json$/u),
      countEntries(roots.adoptedWritings, /^adopted_chapter_/u),
      countEntries(roots.settlementContexts, /^settlement_ctx_/u),
      countEntries(roots.settlementReports, /^settlement_report_/u),
    ]),
  ]);
  return {
    bridge_phase: chatgptBridgeSafety.bridge_phase,
    active_engine: activeEngine,
    compressed_rules: compressedRules,
    records: {
      writing_contexts: counts[0],
      writing_candidates: counts[1],
      proofing_contexts: counts[2],
      proof_reports: counts[3],
      approval_items: counts[4],
      adopted_writings: counts[5],
      settlement_contexts: counts[6],
      settlement_reports: counts[7],
    },
    active_engine_modified: false,
    compressed_rules_modified: false,
    safety: chatgptBridgeSafety,
  };
}

export async function getChatgptBridgeCurrentInputs(rawInput = {}, options = {}) {
  if (!rawInput || typeof rawInput !== "object" || Array.isArray(rawInput)) {
    throw new Error("input must be an object.");
  }
  const includeText = optionalBoolean(
    rawInput.include_text ?? rawInput.includeText,
    true,
    "include_text",
  );
  const includeActiveEngineMetadata = optionalBoolean(
    rawInput.include_active_engine_metadata ?? rawInput.includeActiveEngineMetadata,
    true,
    "include_active_engine_metadata",
  );
  const includeActiveEngineText = optionalBoolean(
    rawInput.include_active_engine_text ?? rawInput.includeActiveEngineText,
    false,
    "include_active_engine_text",
  );
  const maxChars = optionalInteger(
    rawInput.max_chars ?? rawInput.maxChars,
    defaultMaxChars,
    "max_chars",
  );
  const outputRoot = options.outputs
    ? assertPathInside(options.outputs, projectPaths.outputs, "outputs test root")
    : projectPaths.outputs;
  const inputs = await Promise.all([
    ["task_prompt", path.join(outputRoot, "task_prompt.md")],
    ["generation_context", path.join(outputRoot, "generation_context.md")],
    ["retrieval_context", path.join(outputRoot, "retrieval_context.md")],
  ].map(async ([label, filePath]) => [
    label,
    await fileSnapshot(filePath, includeText, maxChars),
  ]));
  const activeEnginePath = options.activeEnginePath
    ? assertPathInside(options.activeEnginePath, projectPaths.canonDb, "active engine test path")
    : projectPaths.activeEngine;
  return {
    inputs: Object.fromEntries(inputs),
    // Provide a bounded task_prompt preview and metadata for bridge consumers.
    bounded_task_prompt: (() => {
      try {
        const snapshot = Object.fromEntries(inputs)["task_prompt"];
        const { bounded, meta } = boundTaskPromptFromSnapshot(snapshot, 12000);
        return { text: bounded, meta };
      } catch {
        return { text: "", meta: {} };
      }
    })(),
    active_engine: includeActiveEngineMetadata
      ? await fileSnapshot(activeEnginePath, includeActiveEngineText, maxChars)
      : null,
    max_chars: maxChars,
    safety: chatgptBridgeSafety,
  };
}

function textToContext(snapshot) {
  if (!snapshot?.exists || typeof snapshot.text !== "string" || !snapshot.text) return {};
  return {
    source_path: snapshot.path,
    source_sha256: snapshot.sha256,
    content: snapshot.text,
    truncated: snapshot.truncated,
  };
}

function normalizeBridgeEntitySearchText(value) {
  return String(value ?? "")
    .toLocaleLowerCase("zh-Hant")
    .replace(/[\s｜|、，,。；;：:（）()[\]【】「」『』《》<>]+/gu, " ")
    .trim();
}

function bridgeEntitySearchTokens(query) {
  const normalized = normalizeBridgeEntitySearchText(query);
  if (!normalized) return [];
  return [...new Set(normalized.split(/\s+/u).filter(Boolean))];
}

function bridgeEntitySearchHaystack(entity = {}) {
  return normalizeBridgeEntitySearchText([
    entity.canonical_name,
    entity.entity_id,
    ...(Array.isArray(entity.aliases) ? entity.aliases : []),
    entity.source_excerpt,
    entity.source_section,
    ...(Array.isArray(entity.related_chapters) ? entity.related_chapters : []),
    ...(Array.isArray(entity.related_characters) ? entity.related_characters : []),
    ...(Array.isArray(entity.related_entities) ? entity.related_entities : []),
  ].filter(Boolean).join("\n"));
}

function bridgeEntitySearchScore(entity = {}, tokens = []) {
  if (tokens.length === 0) return 0;

  const canonical = normalizeBridgeEntitySearchText(entity.canonical_name);
  const entityId = normalizeBridgeEntitySearchText(entity.entity_id);
  const haystack = bridgeEntitySearchHaystack(entity);

  let score = 0;
  for (const token of tokens) {
    if (canonical === token) score += 100;
    else if (canonical.includes(token)) score += 60;
    else if (entityId.includes(token)) score += 40;
    else if (haystack.includes(token)) score += 10;
  }
  return score;
}


export async function buildChatgptBridgeWritingContext(rawInput = {}, options = {}) {
  const useCurrentInputs = optionalBoolean(
    rawInput.use_current_inputs ?? rawInput.useCurrentInputs,
    true,
    "use_current_inputs",
  );
  let current = null;
  if (useCurrentInputs) {
    current = await getChatgptBridgeCurrentInputs({
      includeText: true,
      includeActiveEngineMetadata: false,
      maxChars: rawInput.max_context_chars ?? rawInput.maxContextChars,
    }, options);
  }
  let taskPromptMetadata = null;
  const taskPrompt = rawInput.task_prompt
    ?? rawInput.taskPrompt
    ?? (() => {
      // If an explicit task_prompt argument was not provided, derive from current inputs and bound it.
      try {
        const snapshot = current?.inputs?.task_prompt;
        if (!snapshot || typeof snapshot.text !== "string") return "";
        const { bounded, meta } = boundTaskPromptFromSnapshot(snapshot, 12000);
        // stash metadata for later bundle persistence
        taskPromptMetadata = meta;
        return bounded;
      } catch {
        return current?.inputs.task_prompt?.text ?? "";
      }
    })();
  const result = await buildGptWritingContext({
    ...rawInput,
    taskPrompt,
    generationContext: rawInput.generation_context
      ?? rawInput.generationContext
      ?? textToContext(current?.inputs.generation_context),
    retrievalContext: rawInput.retrieval_context
      ?? rawInput.retrievalContext
      ?? textToContext(current?.inputs.retrieval_context),
    includeActiveEngine: rawInput.include_active_engine
      ?? rawInput.includeActiveEngine
      ?? false,
  }, options);

  // If we bounded the task prompt from current inputs, persist metadata into the bundle and chat markdown.
  if (taskPromptMetadata) {
    try {
      const bundlePath = result.context_bundle_path;
      const chatPath = result.context_for_chat_path;
      const updatedBundle = { ...result.bundle, task_prompt_metadata: taskPromptMetadata };
      result.bundle = updatedBundle;
      // read existing chat markdown and append a metadata section
      let chatText = "";
      try {
        chatText = await readFile(path.join(projectRoot, chatPath), "utf8");
      } catch (err) {
        chatText = null;
      }
      const metaLines = [
        "## Task Prompt Metadata",
        "",
        `- original_task_prompt_chars: ${taskPromptMetadata.original_task_prompt_chars}`,
        `- task_prompt_chars_used: ${taskPromptMetadata.task_prompt_chars_used}`,
        `- task_prompt_truncated: ${taskPromptMetadata.task_prompt_truncated}`,
        `- task_prompt_source_path: ${taskPromptMetadata.task_prompt_source_path}`,
        `- task_prompt_source_sha256: ${taskPromptMetadata.task_prompt_source_sha256}`,
        "",
      ].join("\n");
      const newChat = chatText === null ? metaLines : `${chatText}\n\n${metaLines}`;
      await commitFileTransaction("attach-task-prompt-metadata", [
        { filePath: bundlePath, content: `${JSON.stringify(updatedBundle, null, 2)}\n` },
        { filePath: chatPath, content: newChat },
      ], { phase: "phase_21e_task_prompt_bounding" });
    } catch (err) {
      // attach warning
      result.bundle = result.bundle || {};
      result.bundle.warnings = result.bundle.warnings || [];
      result.bundle.warnings.push(`failed_to_persist_task_prompt_metadata: ${err.message}`);
    }
  }

  // Optional, read-only, bounded entity registry integration
  try {
    const includeEntityRegistry = optionalBoolean(
      rawInput.include_entity_registry ?? rawInput.includeEntityRegistry,
      false,
      "include_entity_registry",
    );
    if (includeEntityRegistry) {
      // normalize inputs
      const entityQuery = rawInput.entity_query ?? rawInput.entityQuery ?? null;
      if (entityQuery && typeof entityQuery === "string" && Array.from(entityQuery).length > 120) {
        throw new Error("entityQuery must be at most 120 characters.");
      }
      const entityIds = Array.isArray(rawInput.entity_ids ?? rawInput.entityIds)
        ? rawInput.entity_ids ?? rawInput.entityIds
        : null;
      if (entityIds && entityIds.length > 20) throw new Error("entityIds must contain at most 20 items.");
      if (entityIds && entityIds.some((id) => typeof id !== "string" || Array.from(id).length > 160)) {
        throw new Error("entityIds must be strings up to 160 characters.");
      }
      const entityCategories = Array.isArray(rawInput.entity_categories ?? rawInput.entityCategories)
        ? rawInput.entity_categories ?? rawInput.entityCategories
        : null;
      const allowedCategories = new Set([
        "character",
        "ability",
        "weapon",
        "organization",
        "location",
        "timeline_event",
        "world_rule",
        "chapter_event",
        "status_effect",
      ]);
      if (entityCategories && entityCategories.some((c) => !allowedCategories.has(c))) {
        throw new Error("entityCategories contained unknown category.");
      }
      const entityLimit = rawInput.entity_limit ?? rawInput.entityLimit ?? 20;
      if (!Number.isInteger(entityLimit) || entityLimit < 1 || entityLimit > 50) {
        throw new Error("entityLimit must be an integer between 1 and 50.");
      }
      const includeEntityEvidence = optionalBoolean(
        rawInput.include_entity_evidence ?? rawInput.includeEntityEvidence,
        true,
        "include_entity_evidence",
      );
      const includeEntityProvenance = optionalBoolean(
        rawInput.include_entity_provenance ?? rawInput.includeEntityProvenance,
        false,
        "include_entity_provenance",
      );

      const context = {
        enabled: true,
        source: "structured_canon_entity_registry",
        query: entityQuery ?? null,
        categories: entityCategories ?? null,
        limit: entityLimit,
        entities: [],
        warnings: [],
      };

      // Read registry files directly (read-only). If files missing or parse error, warn and continue.
      try {
        const registryText = await readFile(projectPaths.entityRegistryData, "utf8");
        const indexText = await readFile(projectPaths.entityRegistryIndex, "utf8");
        const registry = JSON.parse(registryText);
        const index = JSON.parse(indexText);

        // helper to push entity object into context.entities
        const pushEntity = (entity) => {
          context.entities.push({
            entity_id: entity.entity_id,
            category: entity.entity_type,
            name: entity.canonical_name,
            aliases: entity.aliases ?? [],
            summary: entity.source_excerpt ?? "",
            canonical_status: entity.status ?? entity.status,
            risk_flags: entity.risk_level ? [entity.risk_level] : [],
            evidence_refs: includeEntityEvidence ? (entity.source_anchor ? [entity.source_anchor] : []) : [],
            related_entity_ids: entity.related_entities ?? [],
          });
        };

        if (entityIds && entityIds.length) {
          for (const id of entityIds.slice(0, 20)) {
            const entry = index.by_id?.[id];
            if (entry) {
              const typeKey = Object.keys(registry).find((k) => Array.isArray(registry[k]) && registry[k].some((e) => e.entity_id === id));
              const entity = registry[typeKey].find((e) => e.entity_id === id);
              if (entity) pushEntity(entity);
            }
          }
        } else {
          // search by query / category
          const buckets = entityCategories && entityCategories.length
            ? entityCategories.map((c) => {
              // map to plural keys used in registry
              return {
                character: "characters",
                ability: "abilities",
                weapon: "weapons",
                organization: "organizations",
                location: "locations",
                timeline_event: "timeline_events",
                world_rule: "world_rules",
                chapter_event: "chapter_events",
                status_effect: "status_effects",
              }[c];
            }).filter(Boolean)
            : Object.keys(registry).filter((k) => Array.isArray(registry[k]));

          const queryTokens = bridgeEntitySearchTokens(entityQuery);
          const candidates = [];
          for (const bucket of buckets) {
            for (const entity of registry[bucket] ?? []) {
              const score = bridgeEntitySearchScore(entity, queryTokens);
              if (queryTokens.length > 0 && score <= 0) continue;
              candidates.push({ entity, score });
            }
          }

          candidates.sort((a, b) => (
            (b.score - a.score)
            || String(a.entity.canonical_name ?? "").localeCompare(String(b.entity.canonical_name ?? ""))
            || String(a.entity.entity_id ?? "").localeCompare(String(b.entity.entity_id ?? ""))
          ));

          for (const { entity } of candidates.slice(0, entityLimit)) pushEntity(entity);
        }

        if (includeEntityProvenance) {
          try {
            const provText = await readFile(projectPaths.entityRegistryProvenance, "utf8");
            const prov = JSON.parse(provText);
            context.registry_hashes = prov;
          } catch (err) {
            context.warnings.push("could not read provenance");
          }
        }
      } catch (error) {
        if (error.code === "ENOENT") {
          context.warnings.push("entity registry files missing");
        } else {
          context.warnings.push("entity registry parse error");
        }
      }

      result.entity_registry_context = context;
      // Persist entity_registry_context back into the written bundle and chat markdown
      try {
        const bundlePath = result.context_bundle_path;
        const chatPath = result.context_for_chat_path;
        const updatedBundle = { ...result.bundle, entity_registry_context: context };
        // read existing chat markdown and append a summary section
        let chatText = "";
        try {
          chatText = await readFile(path.join(projectRoot, chatPath), "utf8");
        } catch (err) {
          chatText = null;
        }
        const summaryLines = [
          "## Entity Registry Context",
          "",
          `- enabled: ${String(context.enabled)}`,
          `- source: ${context.source}`,
          `- query: ${context.query == null ? "(none)" : String(context.query)}`,
          `- categories: ${Array.isArray(context.categories) && context.categories.length > 0 ? JSON.stringify(context.categories) : "(all)"}`,
          `- limit: ${String(context.limit)}`,
          `- entities: ${Array.isArray(context.entities) ? context.entities.length : 0} items`,
          "",
          "```json",
          JSON.stringify(context, null, 2),
          "```",
          "",
        ].join("\n");
        const newChat = chatText === null ? summaryLines : `${chatText}\n\n${summaryLines}`;
        await commitFileTransaction("attach-entity-registry-context", [
          { filePath: bundlePath, content: `${JSON.stringify(updatedBundle, null, 2)}\n` },
          { filePath: chatPath, content: newChat },
        ], { phase: "phase_21d_entity_registry_context_persist_hotfix" });
      } catch (err) {
        // If persisting fails, add a warning but continue
        result.entity_registry_context.warnings.push(`failed_to_persist_entity_registry_context: ${err.message}`);
      }
    }
  } catch (error) {
    // validation errors should surface as warnings rather than breaking the context build
    result.entity_registry_context = { enabled: false, entities: [], warnings: [error.message] };
  }
  const writingContextId = result.bundle?.bundle_id ?? null;

  return {
    ...result,
    writing_context_id: writingContextId,
    source_bundle_id: writingContextId,
    sourceBundleId: writingContextId,
    context_bundle_path: result.context_bundle_path ?? null,
    context_for_chat_path: result.context_for_chat_path ?? null,
    generated_locally: false,
    safety: chatgptBridgeSafety,
  };
}

export async function saveChatgptBridgeCandidate(input = {}, options = {}) {
  const result = await saveChatOutputAsWritingCandidate({
    ...input,
    source: input.source ?? "chatgpt",
    chapterLabel: input.chapter ?? input.chapter_label ?? input.chapterLabel,
  }, options);
  return { ...result, candidate_only: true, safety: chatgptBridgeSafety };
}

export async function buildChatgptBridgeProofingContext(input = {}, options = {}) {
  const result = await buildCandidateProofingContext({
    ...input,
    includeActiveEngine: input.include_active_engine
      ?? input.includeActiveEngine
      ?? false,
  }, options);
  // Mirror writing context's optional entity registry integration
  try {
    const includeEntityRegistry = optionalBoolean(
      input.include_entity_registry ?? input.includeEntityRegistry,
      false,
      "include_entity_registry",
    );
    if (includeEntityRegistry) {
      // Delegate to writing-context's implementation by reusing similar logic
      const proxyInput = {
        include_entity_registry: true,
        entity_query: input.entity_query ?? input.entityQuery,
        entity_ids: input.entity_ids ?? input.entityIds,
        entity_categories: input.entity_categories ?? input.entityCategories,
        entity_limit: input.entity_limit ?? input.entityLimit,
        include_entity_evidence: input.include_entity_evidence ?? input.includeEntityEvidence,
        include_entity_provenance: input.include_entity_provenance ?? input.includeEntityProvenance,
      };
      // call the same logic by invoking buildChatgptBridgeWritingContext with a tiny wrapper
      const writingCtx = await buildChatgptBridgeWritingContext(proxyInput, options);
      result.entity_registry_context = writingCtx.entity_registry_context ?? { enabled: false, entities: [], warnings: [] };
    }
  } catch (err) {
    result.entity_registry_context = { enabled: false, entities: [], warnings: [err.message] };
  }
  return { ...result, generated_locally: false, safety: chatgptBridgeSafety };
}

export async function saveChatgptBridgeProofReport(input = {}, options = {}) {
  const result = await saveChatOutputAsProofReport({
    ...input,
    source: input.source ?? "chatgpt",
  }, options);
  return { ...result, candidate_only: true, safety: chatgptBridgeSafety };
}

export async function requestChatgptBridgeAdoption(input = {}, options = {}) {
  const result = await requestWritingCandidateAdoption({
    ...input,
    requestSource: "chatgpt_bridge",
    sourcePhase: "phase_14a_lite",
    verifiedBy: "phase_14b_e2e_dry_run",
  }, options);

  const approvalQueueNextAction =
    "Open the Writer Workbench approval queue and explicitly confirm this adoption request.";
  const blockedAdoptionNextAction =
    "Adoption request was blocked before approval queue creation. Review blocked_reasons on the candidate/proof report detail page.";

  return {
    ...result,
    adopted: false,
    next_action: result.approval_item_created
      ? approvalQueueNextAction
      : (result.next_action ?? blockedAdoptionNextAction),
    safety: chatgptBridgeSafety,
  };
}

export async function buildChatgptBridgeSettlementContext(input = {}, options = {}) {
  const result = await buildAdoptedWritingSettlementContext({
    ...input,
    includeActiveEngine: input.include_active_engine
      ?? input.includeActiveEngine
      ?? false,
  }, options);
  return { ...result, generated_locally: false, safety: chatgptBridgeSafety };
}

export async function saveChatgptBridgeSettlementReport(input = {}, options = {}) {
  const result = await saveChatOutputAsSettlementReport({
    ...input,
    source: input.source ?? "chatgpt",
  }, options);
  return {
    ...result,
    pending_engine_candidate_created: false,
    active_engine_modified: false,
    safety: chatgptBridgeSafety,
  };
}

export async function runChatgptBridgeFullRecursiveWritingPipeline(input = {}, options = {}) {
  const result = await runFullRecursiveWritingPipeline({
    ...input,
    output_mode: "chat_text",
  }, options);
  return {
    ...result,
    output_mode: "chat_text",
    revision_rounds_attempted: result.recursive_revision?.rounds_attempted ?? 0,
    character_voice_guard_display: result.character_voice_guard?.display ?? null,
    warnings: result.report?.warnings ?? [],
    next_action: result.final_candidate_text
      ? "Output final_candidate_text directly in the chat; do not generate a separate raw draft."
      : `Do not output fabricated prose. Stop reason: ${result.stop_reason ?? "pipeline_failed"}.`,
    safety: chatgptBridgeSafety,
  };
}
