import {
  beginChatgptOwnedExternalBrainWritingSession,
} from "./chatgpt-owned-external-brain-service.mjs";
import {
  buildDraftEntityAudit,
} from "./draft-entity-audit-service.mjs";
import {
  runEphemeralNeuralCritic,
} from "./neural-module-service.mjs";

const toolName = "chatgpt_bridge_review_draft_ephemeral";
const chapterModes = new Set([
  "next_chapter",
  "specific_scene",
  "rewrite_candidate",
]);

export const ephemeralDraftReviewMutationGuards = Object.freeze({
  writing_context_record_created: false,
  candidate_created: false,
  canon_updated: false,
  active_engine_updated: false,
  adopted: false,
  settled: false,
  approval_created: false,
  activation_requested: false,
});

export class EphemeralDraftReviewValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "EphemeralDraftReviewValidationError";
  }
}

function objectInput(value, name, fallback = {}) {
  if (value === undefined) return fallback;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new EphemeralDraftReviewValidationError(`${name} must be an object.`);
  }
  return value;
}

function requiredText(value, name) {
  if (typeof value !== "string" || !value.trim()) {
    throw new EphemeralDraftReviewValidationError(
      `${name} is required and must not be blank.`,
    );
  }
  return value;
}

function maxContextChars(value) {
  const normalized = value ?? 48_000;
  if (
    !Number.isInteger(normalized)
    || normalized < 4_000
    || normalized > 120_000
  ) {
    throw new EphemeralDraftReviewValidationError(
      "max_context_chars must be an integer between 4000 and 120000.",
    );
  }
  return normalized;
}

function chapterMode(value) {
  const normalized = value ?? "next_chapter";
  if (!chapterModes.has(normalized)) {
    throw new EphemeralDraftReviewValidationError(
      "chapter_mode must be next_chapter, specific_scene, or rewrite_candidate.",
    );
  }
  return normalized;
}

function diagnosticRetrievalContext(retrievalContext, draftText) {
  const worldRuleQueries = [];
  if (
    /(?:異能武裝|武裝召喚|武裝維持|本體顯現|投影顯現|能力使用限制|召喚[^。\n]{0,48}《)/u
      .test(draftText)
  ) {
    worldRuleQueries.push(
      "異能武裝召喚與維持準則",
      "能力體系",
    );
  }
  if (
    /(?:傷勢|受傷|裂傷|切創|負荷|治療|醫療|後座)/u
      .test(draftText)
  ) {
    worldRuleQueries.push("高科技靈力醫療與治療限制");
  }
  if (worldRuleQueries.length === 0) return { ...retrievalContext };
  return {
    ...retrievalContext,
    post_draft_diagnostic_retrieval: {
      world_rule_queries: [...new Set(worldRuleQueries)],
      draft_text_injected_as_background: false,
      purpose: "typed_canon_and_logic_diagnostic_retrieval_only",
    },
  };
}

function serializedChars(value) {
  return JSON.stringify(value, null, 2).length;
}

function hardConflictCandidates(sceneCompatibility = {}) {
  return (sceneCompatibility.findings ?? []).filter((finding) => (
    finding?.status === "requires_justification"
    || finding?.status === "hard_conflict"
  ));
}

export async function reviewDraftEphemeral(input = {}, options = {}) {
  const normalizedInput = objectInput(input, "input");
  const taskPrompt = requiredText(
    normalizedInput.task_prompt,
    "task_prompt",
  );
  const draftText = requiredText(
    normalizedInput.draft_text,
    "draft_text",
  );
  const plannedEntityManifest = objectInput(
    normalizedInput.planned_entity_manifest,
    "planned_entity_manifest",
  );
  const generationContext = objectInput(
    normalizedInput.generation_context,
    "generation_context",
  );
  const retrievalContext = objectInput(
    normalizedInput.retrieval_context,
    "retrieval_context",
  );
  const resolvedChapterMode = chapterMode(normalizedInput.chapter_mode);
  const resolvedMaxContextChars = maxContextChars(
    normalizedInput.max_context_chars,
  );
  const formalRetrievalContext = diagnosticRetrievalContext(
    retrievalContext,
    draftText,
  );

  const formalResult =
    await beginChatgptOwnedExternalBrainWritingSession({
      task_prompt: taskPrompt,
      planned_entity_manifest: plannedEntityManifest,
      generation_context: generationContext,
      retrieval_context: formalRetrievalContext,
      chapter_mode: resolvedChapterMode,
      max_context_chars: resolvedMaxContextChars,
      ephemeral: true,
      persist_context: false,
    }, options);
  const formalContext = formalResult?.formal_context;
  if (!formalContext || typeof formalContext !== "object") {
    throw new Error("Ephemeral formal writing context was not returned.");
  }
  if (
    formalResult.external_brain_session_id !== null
    || formalResult.writing_context_bundle_id !== null
    || formalResult.context_persisted !== false
    || formalResult.writing_context_record_created !== false
  ) {
    throw new Error("Ephemeral formal context unexpectedly created persisted state.");
  }

  const materials = formalContext.materials ?? {};
  const draftAudit = await buildDraftEntityAudit({
    draftText,
    plannedEntityManifest:
      materials.planned_entity_manifest
      ?? plannedEntityManifest,
    plannedEntityHydration:
      materials.planned_entity_hydration
      ?? {},
    relevantCanon:
      materials.relevant_canon
      ?? {},
  }, options);
  const structuredCandidates = hardConflictCandidates(
    draftAudit.scene_compatibility,
  );
  const criticRuntime = runEphemeralNeuralCritic({
    task_prompt: taskPrompt,
    writing_context: {
      formal_context: formalContext,
    },
    capability_input: {
      draft_text: draftText,
      draft_entity_audit: draftAudit.draft_entity_audit,
      draft_canon_coverage: draftAudit.draft_canon_coverage,
      scene_compatibility: draftAudit.scene_compatibility,
      relevant_canon: draftAudit.relevant_canon,
      structured_hard_conflict_candidates: structuredCandidates,
      post_draft_diagnostic_composition:
        draftAudit.post_draft_diagnostic_composition,
    },
  });
  const criticOutput = criticRuntime.output;
  const exactLineEvidence = criticOutput.findings ?? [];
  const hardConflicts = exactLineEvidence.filter(
    (finding) => finding.must_fix === true,
  );
  const sceneCompatibility =
    draftAudit.scene_compatibility?.findings
    ?? [];
  const neuralCritic = {
    status: "completed",
    module_name: "neural_critic",
    execution_mode: criticRuntime.execution_mode,
    trace_persisted: criticRuntime.trace_persisted,
    analysis_status: criticOutput.analysis_status,
    exact_line_evidence: exactLineEvidence,
    hard_conflicts: hardConflicts,
  };
  const diagnosticPayload = {
    draft_entity_audit: draftAudit.draft_entity_audit,
    draft_canon_coverage: draftAudit.draft_canon_coverage,
    scene_compatibility: sceneCompatibility,
    structured_hard_conflict_candidates: structuredCandidates,
    neural_critic: neuralCritic,
  };
  const activeEngineFullTextIncluded = (
    formalResult.context_composition
      ?.active_engine_full_text_included === true
    || draftAudit.post_draft_diagnostic_composition
      ?.active_engine_full_text_included === true
  );

  return {
    ok: true,
    tool_name: toolName,
    status: "ephemeral_draft_review_complete",
    external_brain_session_id: null,
    writing_context_bundle_id: null,
    formal_context: formalContext,
    planned_entity_hydration:
      materials.planned_entity_hydration
      ?? {},
    planned_canon_coverage:
      materials.planned_canon_coverage
      ?? {},
    draft_entity_audit: draftAudit.draft_entity_audit,
    draft_canon_coverage: draftAudit.draft_canon_coverage,
    scene_location:
      draftAudit.scene_compatibility?.scene_location
      ?? null,
    scene_compatibility: sceneCompatibility,
    structured_hard_conflict_candidates: structuredCandidates,
    neural_critic: neuralCritic,
    diagnostic_modules_executed: ["neural_critic"],
    diagnostic_modules_not_executed: [
      "style_drift_detector",
      "final_polisher",
    ],
    diagnostic_relevant_canon: draftAudit.relevant_canon,
    context_composition: {
      formal_context_chars: serializedChars(formalContext),
      max_context_chars: resolvedMaxContextChars,
      post_draft_diagnostic_chars: serializedChars(diagnosticPayload),
      draft_audit_composition_chars:
        draftAudit.post_draft_diagnostic_composition?.total_chars
        ?? 0,
      relevant_canon_chars:
        serializedChars(draftAudit.relevant_canon ?? {}),
      relevant_canon_budget_chars: 18_000,
      active_engine_retrieval_chars:
        draftAudit.post_draft_diagnostic_composition
          ?.active_engine_retrieval_chars
        ?? 0,
      active_engine_retrieval_budget_chars: 12_000,
      active_engine_full_text_included:
        activeEngineFullTextIncluded,
      full_active_engine_fallback_allowed: false,
      full_active_engine_fallback_used: false,
      formal_context_record_mutated: false,
    },
    mutation_guards: { ...ephemeralDraftReviewMutationGuards },
  };
}
