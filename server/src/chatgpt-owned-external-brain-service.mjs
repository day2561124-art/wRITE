import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  createAgentRun,
  finalizeAgentRun,
  getAgentRun,
  recordExternalBrainSessionActivity,
  transitionExternalBrainSessionLifecycle,
} from "./agent-run-service.mjs";
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
import {
  loadVerifiedPriorAuthorshipCognition,
  priorAuthorshipCognitionModules,
} from "./external-brain-cognition-output-service.mjs";
import {
  buildDeterministicCharacterSimulation,
  buildDeterministicNeuralCritique,
  buildDeterministicOverGovernanceReport,
  buildDeterministicScenePlan,
  buildDeterministicStyleDriftReport,
  buildDeterministicWritingCard,
  buildDirectorPriorCognitionSurface,
} from "./external-brain-generation-surface-service.mjs";
import {
  getRuntimeProcessInstanceId,
} from "./raw-story-handoff-seal-service.mjs";
import { expandGeneratedCastCanonGrounding } from "./generated-cast-canon-grounding-service.mjs";
import {
  expandGeneratedWorldEntityCanonGrounding,
} from "./generated-world-entity-canon-grounding-service.mjs";
import { resolveProjectPath } from "./project-paths.mjs";
import {
  buildRawStoryMismatchForensics,
  validateRawStoryIntegrityManifest,
} from "./raw-story-handoff-integrity-service.mjs";
import {
  acquireRawStoryHandoff,
  assertRawStoryHandoffSessionScope,
  completeRawStoryHandoffConsumption,
  releaseRawStoryHandoffAcquisition,
  sealRawStoryHandoff,
} from "./raw-story-handoff-seal-service.mjs";

// Phase48 compatibility vocabulary retained in source-level contracts only:
// hard_risk_scope; inactive_without_draft_evidence; do not convert diagnostics into prose requirements;
// explicit user requirements; v4.1-minimal; evidence_triggered_minimal_review;
// hard_conflicts_and_exact_evidence_only. These labels must not force
// control-plane material into the generation-visible capability output.

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

export function shouldEnableStoryMaterialCognition(capabilityName, options = {}) {
  if (!externalBrainPreGenerationCapabilities.includes(capabilityName)) return false;
  if (options.story_material_cognition_output === true) return true;
  if (options.story_material_cognition_output === false) return false;
  return options.adapter === undefined;
}

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

const writingTechniqueFamilyMethods = Object.freeze({
  constraint_driven_conflict: Object.freeze([
    "incorrect hypothesis",
    "observation → test → cost → revision",
    "physical position reasoning",
    "character choice changes actual state",
    "growth shown through changed action",
  ]),
  restriction_and_pressure: Object.freeze([
    "restrictions entangled with character pressure",
    "information asymmetry",
    "unresolved pressure affecting later ordinary action",
  ]),
  relational_comedy: Object.freeze([
    "relationships can exist without progressing every scene",
    "natural useless banter",
    "abrupt but earned tonal gear changes",
  ]),
  ensemble_motion: Object.freeze([
    "ensemble heat",
    "characters move independently",
    "groups separate and naturally collide",
  ]),
  subtle_relationships: Object.freeze([
    "distance change",
    "hesitation",
    "address form",
    "small boundary shifts",
  ]),
});

const availableWritingTechniqueFamilies = Object.freeze(Object.keys(writingTechniqueFamilyMethods));

function resolveWritingTechniqueSelection(capabilityInput = {}) {
  const requested = capabilityInput.selected_technique_families;
  if (requested === undefined) {
    return { selected_technique_families: [], active_technique_cognition: {} };
  }
  if (!Array.isArray(requested)) {
    throw new Error("selected_technique_families must be an array of technique family names.");
  }
  const selected = [...new Set(requested)];
  const unknown = selected.filter((family) => (
    typeof family !== "string" || !Object.hasOwn(writingTechniqueFamilyMethods, family)
  ));
  if (unknown.length) {
    throw new Error(`Unknown technique family: ${unknown.map((family) => JSON.stringify(family)).join(", ")}.`);
  }
  if (selected.length > 2) {
    throw new Error(`selected_technique_families accepts at most two unique families; received ${selected.length}.`);
  }
  return {
    selected_technique_families: selected,
    active_technique_cognition: Object.fromEntries(
      selected.map((family) => [family, [...writingTechniqueFamilyMethods[family]]]),
    ),
  };
}

export function compactPromptPayloadValue(value) {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (typeof value === "string") {
    return value.trim() ? value : undefined;
  }

  if (Array.isArray(value)) {
    const compacted = value
      .map((item) => compactPromptPayloadValue(item))
      .filter((item) => item !== undefined);

    return compacted.length > 0 ? compacted : undefined;
  }

  if (typeof value === "object") {
    const compacted = {};

    for (const [key, item] of Object.entries(value)) {
      const compactedItem = compactPromptPayloadValue(item);

      if (compactedItem !== undefined) {
        compacted[key] = compactedItem;
      }
    }

    return Object.keys(compacted).length > 0
      ? compacted
      : undefined;
  }

  return value;
}

export function buildMinimalWritingCardPromptContext(value) {
  const source =
    value
    && typeof value === "object"
    && !Array.isArray(value)
      ? value
      : {};

  return compactPromptPayloadValue({
    context_kind:
      source.context_kind
      ?? "writing_card_director_context",
    chapter_anchor_summary:
      source.chapter_anchor_summary,
  });
}
function sha256(value) {
  return createHash("sha256").update(String(value ?? "")).digest("hex");
}

function requiredText(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  return value;
}

function validSha256(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
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

function compactCharacterHardFacts(packet = {}) {
  const characters = Array.isArray(packet?.characters) ? packet.characters : [];
  return characters.map((character) => ({
    canonical_name: character.canonical_name,
    source_authority: character.source_authority ?? packet.source_authority ?? null,
    source_file: character.source_file ?? packet.source_file ?? null,
    source_section: character.source_section ?? null,
    gender: character.gender ?? null,
    pronouns: character.pronouns ?? {
      third_person: null,
      second_person: null,
      resolved: false,
    },
    identity_facts: character.identity_facts ?? [],
    affiliation_facts: character.affiliation_facts ?? [],
    appearance_facts: character.appearance_facts ?? [],
    relationship_or_position_facts: character.relationship_or_position_facts ?? [],
    explicit_body_traits: character.explicit_body_traits ?? [],
    grounding_classification: character.grounding_classification ?? null,
    unsupported_body_trait_policy: character.unsupported_body_trait_policy
      ?? packet.body_trait_policy?.rule
      ?? null,
  }));
}

function compactFactText(values, maxChars) {
  return compactText(
    Array.isArray(values) ? values.join("；") : "",
    maxChars,
  );
}

function compactAmbiguousCanonCandidates(packet = {}) {
  const candidates = Array.isArray(packet?.ambiguous_existing_canon_candidates)
    ? packet.ambiguous_existing_canon_candidates
    : [];

  return candidates.map((candidate) => ({
    canonical_name: candidate.canonical_name,
    source_authority: candidate.source_authority ?? packet.source_authority ?? null,
    gender: candidate.gender ?? null,
    pronouns: candidate.pronouns ?? {
      third_person: null,
      second_person: null,
      resolved: false,
    },
    identity: compactFactText(candidate.identity_facts, 320),
    affiliation: compactFactText(candidate.affiliation_facts, 240),
    appearance: compactFactText(candidate.appearance_facts, 320),
    position: compactFactText(candidate.relationship_or_position_facts, 320),
    explicit_body_traits: candidate.explicit_body_traits ?? [],
    mention: {
      passage: compactText(candidate.mention_evidence?.passage, 160),
      reason: candidate.mention_evidence?.reason ?? null,
      collision_suffix: candidate.mention_evidence?.collision_suffix ?? null,
    },
    identity_not_confirmed: candidate.identity_not_confirmed === true,
    identity_resolution_required: candidate.identity_resolution_required === true,
  }));
}

function compactWorldEntityHardFacts(packet = {}) {
  const entities = Array.isArray(packet?.entities)
    ? packet.entities
    : [];

  return entities.map((entity) => ({
    canonical_name: entity.canonical_name,
    entity_type: entity.entity_type ?? "world_entity",
    source_authority:
      entity.source_authority
      ?? packet.source_authority
      ?? null,
    source_file:
      entity.source_file
      ?? packet.source_file
      ?? null,
    facts: compactFactText(entity.canon_facts, 720),
    grounding_classification:
      entity.grounding_classification ?? null,
  }));
}

function compactAmbiguousWorldEntityCandidates(packet = {}) {
  const candidates = Array.isArray(
    packet?.ambiguous_existing_canon_world_entity_candidates,
  )
    ? packet.ambiguous_existing_canon_world_entity_candidates
    : [];

  return candidates.map((candidate) => ({
    canonical_name: candidate.canonical_name,
    entity_type: candidate.entity_type ?? "world_entity",
    source_authority:
      candidate.source_authority
      ?? packet.source_authority
      ?? null,
    facts: compactFactText(candidate.canon_facts, 520),
    mention: {
      passage: compactText(
        candidate.mention_evidence?.passage,
        160,
      ),
      reason: candidate.mention_evidence?.reason ?? null,
    },
    identity_not_confirmed:
      candidate.identity_not_confirmed === true,
    identity_resolution_required:
      candidate.identity_resolution_required === true,
  }));
}

const finalPolisherOriginalEntityFreedomInvariant = (
  "allow_new|absence_not_error_no_block_no_delete|confident_only|unresolved|no_persist"
);

function blockedDirectorResponse({ runId, contextBundleId, run, continuity, reason }) {
  return {
    ok: false,
    tool_name: "chatgpt_bridge_use_writing_card_director",
    architecture_route: externalBrainOwnership.orchestration_mode,
    capability_name: "run_writing_card_director",
    generation_boundary: "pre_generation",
    orchestration_owner: "ChatGPT",
    prose_generator: "ChatGPT",
    full_neural_orchestrator_used: false,
    external_brain_session_id: runId,
    writing_context_bundle_id: contextBundleId,
    capability_output: null,
    blocked: true,
    blocked_stage: "prior_cognition_continuity_integrity",
    blocked_reason: reason,
    missing_prior_cognition_modules: continuity?.missing_modules ?? [],
    invalid_prior_cognition_sources: continuity?.integrity_failures ?? [],
    trace: {
      trace_id: null,
      run_id: runId,
      module_name: "writing_card_director",
      status: "not_executed",
      output_hash: null,
    },
    agent_run_status: run.status,
    mutation_guards: { ...safety },
    ...safety,
  };
}

export function buildFinalPolisherEditorialContract(
  rawStoryText,
  characterCanonGrounding = {},
  worldEntityCanonGrounding = {},
) {
  const story = requiredText(rawStoryText, "raw_story_text");
  const characterHardFacts =
    compactCharacterHardFacts(characterCanonGrounding);
  const generatedCharacterCount =
    characterCanonGrounding
      ?.generated_existing_canon_character_count ?? 0;
  const ambiguousMentions =
    characterCanonGrounding?.ambiguous_mentions ?? [];
  const originalOrUnresolvedMentions =
    characterCanonGrounding
      ?.original_or_unresolved_mentions ?? [];
  const ambiguousExistingCanonCandidates =
    compactAmbiguousCanonCandidates(characterCanonGrounding);
  const entityGroundingRelevant =
    characterHardFacts.length > 0
    || ambiguousMentions.length > 0
    || originalOrUnresolvedMentions.length > 0
    || ambiguousExistingCanonCandidates.length > 0;

  const originalEntityFreedom =
    (
      (
        Array.isArray(
          characterCanonGrounding
            ?.original_or_unresolved_mentions,
        )
        && characterCanonGrounding
          .original_or_unresolved_mentions.length > 0
      )
      || (
        Array.isArray(
          worldEntityCanonGrounding
            ?.original_or_unresolved_world_entities,
        )
        && worldEntityCanonGrounding
          .original_or_unresolved_world_entities.length > 0
      )
    )
      ? finalPolisherOriginalEntityFreedomInvariant
      : null;

  const worldEntityHardFacts =
    compactWorldEntityHardFacts(worldEntityCanonGrounding);
  const generatedWorldEntityCount =
    worldEntityCanonGrounding
      ?.generated_existing_canon_world_entity_count ?? 0;
  const ambiguousWorldEntityMentions =
    worldEntityCanonGrounding?.ambiguous_mentions ?? [];
  const originalOrUnresolvedWorldEntities =
    worldEntityCanonGrounding
      ?.original_or_unresolved_world_entities ?? [];
  const ambiguousWorldEntityCandidates =
    compactAmbiguousWorldEntityCandidates(
      worldEntityCanonGrounding,
    );
  const worldEntityGroundingRelevant =
    worldEntityHardFacts.length > 0
    || ambiguousWorldEntityMentions.length > 0
    || originalOrUnresolvedWorldEntities.length > 0
    || ambiguousWorldEntityCandidates.length > 0;

  return compactPromptPayloadValue({
    result_type: "final_polisher_report",
    editorial_mode: "evidence_triggered_minimal_review",
    raw_story_sha256: sha256(story),
    findings_review_mode:
      "hard_conflicts_and_exact_evidence_only",
    findings: [],
    text_change_required: false,
    release_recommendation: "release_as_is",
    review_boundary:
      "Revise only a material hard conflict supported by exact evidence; otherwise return the original text unchanged.",
    hard_checks: [
      "canon",
      "causal_continuity",
      "character_identity_and_state",
      "timeline",
      "explicit_user_requirement",
    ],
    ...(characterHardFacts.length ? {
      character_canon_grounding_loaded:
        characterCanonGrounding?.loaded === true,
      character_canon_grounding_count:
        characterHardFacts.length,
      character_hard_facts:
        characterHardFacts,
    } : {}),
    ...(worldEntityHardFacts.length ? {
      world_entity_canon_grounding_loaded:
        worldEntityCanonGrounding?.loaded === true,
      world_entity_canon_grounding_count:
        worldEntityHardFacts.length,
      world_entity_hard_facts:
        worldEntityHardFacts,
    } : {}),
    ...(characterCanonGrounding?.expansion_metadata
      && entityGroundingRelevant ? {
      expanded_character_canon_grounding_loaded:
        characterCanonGrounding.loaded === true,
      pre_generation_character_count:
        characterCanonGrounding
          .pre_generation_character_count ?? 0,
      generated_existing_canon_character_count:
        generatedCharacterCount,
      generated_existing_canon_characters:
        characterCanonGrounding
          .generated_existing_canon_characters ?? [],
      ambiguous_canon_mentions:
        ambiguousMentions,
      original_or_unresolved_mentions:
        originalOrUnresolvedMentions,
      generated_cast_expansion:
        characterCanonGrounding.expansion_metadata,
    } : {}),
    ...(worldEntityCanonGrounding?.expansion_metadata
      && worldEntityGroundingRelevant ? {
      expanded_world_entity_canon_grounding_loaded:
        worldEntityCanonGrounding.loaded === true,
      pre_generation_world_entity_count:
        worldEntityCanonGrounding
          .pre_generation_world_entity_count ?? 0,
      generated_existing_canon_world_entity_count:
        generatedWorldEntityCount,
      generated_existing_canon_world_entities:
        worldEntityCanonGrounding
          .generated_existing_canon_world_entities ?? [],
      ambiguous_canon_world_entity_mentions:
        ambiguousWorldEntityMentions,
      original_or_unresolved_world_entities:
        originalOrUnresolvedWorldEntities,
      generated_world_entity_expansion:
        worldEntityCanonGrounding.expansion_metadata,
    } : {}),
    ...(ambiguousExistingCanonCandidates.length ? {
      ambiguous_existing_canon_candidates:
        ambiguousExistingCanonCandidates,
    } : {}),
    ...(ambiguousWorldEntityCandidates.length ? {
      ambiguous_existing_canon_world_entity_candidates:
        ambiguousWorldEntityCandidates,
    } : {}),
    ...(originalEntityFreedom ? {
      original_entity_freedom:
        originalEntityFreedom,
    } : {}),
    prose_ownership: {
      final_prose_generator: "ChatGPT",
      writer_workbench_role:
        "post_generation_editorial_capability_provider",
      writer_workbench_generated_final_prose: false,
    },
  });
}
function deterministicAdapter(capabilityName, rawStoryText = null, runtimeCognition = {}) {
  return async (capabilityInput) => {
    const moduleName = capabilityName.slice(4);
    const taskPrompt = compactText(capabilityInput.task_prompt);
    const writingContext = capabilityInput.writing_context ?? {};
    const preGenerationCharacterCanonGrounding = capabilityInput
      .pre_generation_character_canon_grounding
      ?? writingContext.content?.character_canon_grounding
      ?? {};
    const characterCanonGrounding = capabilityInput.expanded_character_canon_grounding
      ?? capabilityInput.character_canon_grounding
      ?? preGenerationCharacterCanonGrounding;
    const characterHardFacts = compactCharacterHardFacts(characterCanonGrounding);
    const preGenerationWorldEntityCanonGrounding = capabilityInput
      .pre_generation_world_entity_canon_grounding
      ?? writingContext.content?.world_entity_canon_grounding
      ?? {};
    const worldEntityCanonGrounding = capabilityInput
      .expanded_world_entity_canon_grounding
      ?? capabilityInput.world_entity_canon_grounding
      ?? preGenerationWorldEntityCanonGrounding;
    const worldEntityHardFacts =
      compactWorldEntityHardFacts(worldEntityCanonGrounding);
    const worldEntityCognitionRelevant =
      worldEntityHardFacts.length > 0
      || (worldEntityCanonGrounding
        ?.mention_resolution
        ?.ambiguous_mention_count ?? 0) > 0;
    const base = {
      capability_name: capabilityName,
      module_name: moduleName,
      orchestration_mode: externalBrainOwnership.orchestration_mode,
      orchestration_owner: externalBrainOwnership.orchestration_owner,
      runtime_host: externalBrainOwnership.runtime_host,
    };
    if (capabilityName === "run_final_polisher") {
      return {
        ...base,
        generation_boundary: "post_generation",
        ...buildFinalPolisherEditorialContract(
          rawStoryText,
          characterCanonGrounding,
          worldEntityCanonGrounding,
        ),
      };
    }
    const selectedTechniqueFamilies =
      runtimeCognition.technique_selection?.selected_technique_families ?? [];
    const activeTechniqueCognition =
      runtimeCognition.technique_selection?.active_technique_cognition ?? {};

    const requestedCapabilityInput =
      capabilityInput.capability_input
      && typeof capabilityInput.capability_input === "object"
      && !Array.isArray(capabilityInput.capability_input)
        ? capabilityInput.capability_input
        : {};
    const priorGenerationSurfaces =
      capabilityInput.authorship_cognition_sources?.prior_cognition_outputs
      ?? [];
    const groundingSurface = {
      character_canon_grounding_loaded:
        characterCanonGrounding.loaded === true,
      character_canon_grounding_count:
        characterHardFacts.length,
      character_hard_facts:
        characterHardFacts,
      original_entity_freedom:
        characterCanonGrounding.original_entity_freedom ?? null,
      ...(worldEntityCognitionRelevant ? {
        world_entity_canon_grounding_loaded:
          worldEntityCanonGrounding.loaded === true,
        world_entity_canon_grounding_count:
          worldEntityHardFacts.length,
        world_entity_hard_facts:
          worldEntityHardFacts,
      } : {}),
    };
    const semanticOutputs = {
      run_scene_planner: buildDeterministicScenePlan({
        taskPrompt,
        writingContext,
        capabilityInput: requestedCapabilityInput,
      }),
      run_character_simulator: {
        ...buildDeterministicCharacterSimulation({
          taskPrompt,
          writingContext,
          capabilityInput: requestedCapabilityInput,
          characterHardFacts,
        }),
        ...groundingSurface,
      },
      run_neural_critic: {
        ...buildDeterministicNeuralCritique({
          taskPrompt,
          capabilityInput: requestedCapabilityInput,
        }),
        ...groundingSurface,
      },
      run_style_drift_detector: buildDeterministicStyleDriftReport({
        taskPrompt,
        capabilityInput: requestedCapabilityInput,
      }),
      run_over_governance_detector: buildDeterministicOverGovernanceReport({
        taskPrompt,
        capabilityInput: requestedCapabilityInput,
      }),
      run_writing_card_director: {
        ...buildDeterministicWritingCard({
          taskPrompt,
          capabilityInput: requestedCapabilityInput,
          priorOutputs: priorGenerationSurfaces,
          selectedTechniqueFamilies,
          activeTechniqueCognition,
        }),
        ...groundingSurface,
        hard_authority: [
          "Canon",
          "causal continuity",
          "character identity and state",
          "timeline",
          "explicit user requirements",
        ],
        arbitration_rule:
          "Use only material hard constraints; do not convert diagnostics into prose requirements.",
        original_entity_freedom: {
          contract:
            characterCanonGrounding.original_entity_freedom ?? null,
          rule:
            "Canon absence does not prohibit lawful new characters or world entities.",
          ambiguity_rule:
            "Unresolved names remain unresolved instead of being force-bound.",
          persistence_boundary:
            "New prose entities are not automatically persisted.",
        },
        final_prose_ownership: {
          owner: "ChatGPT",
          writer_workbench_role:
            "integrated_authorship_cognition_handoff",
          writer_workbench_generates_story_prose: false,
          story_only_output:
            "Emit only story prose when requested.",
        },
        writing_card_context:
          buildMinimalWritingCardPromptContext(
            writingContext.content?.writing_card_director_context,
          ),
      },
    };
    return {
      ...base,
      generation_boundary: "pre_generation",
      ...semanticOutputs[capabilityName],
    };
  };
}

async function buildVerifiedGeneratedCastGrounding({
  context,
  rawStoryText,
  rawStorySha256,
}) {
  const preGenerationGrounding = context.bundle.content?.character_canon_grounding ?? {};
  const sourceFile = preGenerationGrounding.source_file
    ?? context.bundle.sources?.active_engine?.path
    ?? "data/canon_db/active_engine.md";
  const activeEnginePath = resolveProjectPath(sourceFile, "generated cast active_engine source");
  const activeEngineContent = await readFile(activeEnginePath, "utf8");
  return expandGeneratedCastCanonGrounding({
    rawStoryText,
    rawStorySha256,
    integrityValidated: true,
    existingCharacterCanonGrounding: preGenerationGrounding,
    activeEngineContent,
    sourceFile,
  });
}

async function buildVerifiedGeneratedWorldEntityGrounding({
  context,
  rawStoryText,
  rawStorySha256,
}) {
  const preGenerationGrounding =
    context.bundle.content?.world_entity_canon_grounding ?? {};
  const sourceFile = preGenerationGrounding.source_file
    ?? context.bundle.sources?.active_engine?.path
    ?? "data/canon_db/active_engine.md";
  const activeEnginePath = resolveProjectPath(
    sourceFile,
    "generated world entity active_engine source",
  );
  const activeEngineContent = await readFile(activeEnginePath, "utf8");

  return expandGeneratedWorldEntityCanonGrounding({
    rawStoryText,
    rawStorySha256,
    integrityValidated: true,
    existingWorldEntityCanonGrounding: preGenerationGrounding,
    activeEngineContent,
    sourceFile,
  });
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
    writing_context_bundle_id: context.bundle.bundle_id,
    requires_neural_modules: true,
    required_neural_modules: [...externalBrainPreGenerationCapabilities, "run_final_polisher"]
      .map((name) => name.slice(4)),
    input: JSON.stringify({
      task_prompt: input.task_prompt,
      writing_context_bundle_id: context.bundle.bundle_id,
      orchestration_owner: "chatgpt",
    }),
  }, options);
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

async function missingPreGenerationCapabilities(runId, options = {}) {
  const usage = await summarizeNeuralUsageForRun(runId, options);
  const completed = new Set(usage.neural_modules_used ?? []);
  return externalBrainPreGenerationCapabilities
    .map((name) => name.slice(4))
    .filter((name) => !completed.has(name));
}

async function validateSealAuthority(runId, contextBundleId, options = {}) {
  const run = await getAgentRun(runId, options);
  if (run.mode !== externalBrainOwnership.orchestration_mode) {
    throw new Error("agent_run_id is not a ChatGPT-owned external brain writing session.");
  }
  await getGptWritingContextBundle(contextBundleId, options);
  const missing = await missingPreGenerationCapabilities(runId, options);
  if (missing.length) {
    return { ok: false, run, missing, blocked_stage: "pre_generation_capability_gate" };
  }
  const priorCognition = await loadVerifiedPriorAuthorshipCognition({
    run_id: runId,
    writing_context_bundle_id: contextBundleId,
  }, options);
  if (!priorCognition.ok) {
    const failures = [...priorCognition.integrity_failures.map((failure) => `${failure.module_name}:${failure.code}`), ...priorCognition.missing_modules.map((moduleName) => `${moduleName}:missing`)] ;
    throw new Error(`writing_card_director requires verified exact outputs from all six pre-generation capabilities and prior cognition continuity. ${failures.join(", ")}`);
  }
  return { ok: true, run, priorCognition };
}

export async function sealChatgptOwnedRawStoryHandoff(input = {}, options = {}) {
  const runId = requiredText(sessionId(input), "external_brain_session_id");
  const contextBundleId = requiredText(bundleId(input), "writing_context_bundle_id");
  const readiness = await validateSealAuthority(runId, contextBundleId, options);
  if (!readiness.ok) {
    return {
      ok: false,
      tool_name: "chatgpt_bridge_seal_raw_story_handoff",
      architecture_route: externalBrainOwnership.orchestration_mode,
      handoff_route: "single_ingress_immutable_seal",
      external_brain_session_id: runId,
      writing_context_bundle_id: contextBundleId,
      raw_story_handoff_id: null,
      blocked: true,
      blocked_stage: readiness.blocked_stage,
      missing_pre_generation_capabilities: readiness.missing,
      mutation_guards: { ...safety },
      ...safety,
    };
  }
  const scope = assertRawStoryHandoffSessionScope({
    run_id: runId,
    writing_context_bundle_id: contextBundleId,
  });
  const missing = readiness.missing ?? [];
  if (missing.length) {
    return {
      ok: false,
      tool_name: "chatgpt_bridge_seal_raw_story_handoff",
      architecture_route: externalBrainOwnership.orchestration_mode,
      handoff_route: "single_ingress_immutable_seal",
      external_brain_session_id: runId,
      writing_context_bundle_id: contextBundleId,
      raw_story_handoff_id: null,
      blocked: true,
      blocked_stage: "pre_generation_capability_gate",
      missing_pre_generation_capabilities: missing,
      mutation_guards: { ...safety },
      ...safety,
    };
  }
  const sealed = await sealRawStoryHandoff({
    run_id: runId,
    writing_context_bundle_id: contextBundleId,
    raw_story_text: input.raw_story_text,
  }, options);
  await recordExternalBrainSessionActivity(runId, {
    activity_at: new Date().toISOString(),
    activity_source: `raw_story_handoff_sealed:${sealed.raw_story_handoff_id}`,
  }, options);
  return {
    ok: true,
    tool_name: "chatgpt_bridge_seal_raw_story_handoff",
    architecture_route: externalBrainOwnership.orchestration_mode,
    handoff_route: "single_ingress_immutable_seal",
    external_brain_session_id: runId,
    writing_context_bundle_id: contextBundleId,
    raw_story_handoff_id: sealed.raw_story_handoff_id,
    raw_story_sha256: sealed.raw_story_sha256,
    raw_story_integrity_manifest: sealed.raw_story_integrity_manifest,
    lifecycle_status: sealed.lifecycle_status,
    storage_scope: sealed.storage_scope,
    broker_storage_scope: sealed.broker_storage_scope,
    broker_persistence: sealed.broker_persistence,
    persists_across_process_restart: false,
    runtime_process_instance_id: scope.runtime_process_instance_id,
    seal_child_runtime_process_instance_id: scope.runtime_process_instance_id,
    broker_runtime_process_instance_id: sealed.broker_runtime_process_instance_id,
    seal_ingress_raw_story_sha256: sealed.seal_ingress_raw_story_sha256,
    parent_broker_received_raw_story_sha256: sealed.parent_broker_received_raw_story_sha256,
    internal_payload_continuity_exact_match: sealed.internal_payload_continuity_exact_match,
    orchestration_owner: "ChatGPT",
    prose_generator: "ChatGPT",
    mutation_guards: { ...safety },
    ...safety,
  };
}

function blockedFinalPolisherResponse({
  run,
  runId,
  contextBundleId,
  handoffRoute,
  reason,
  rawStoryIntegrity = null,
}) {
  return {
    ok: false,
    tool_name: "chatgpt_bridge_use_final_polisher",
    architecture_route: externalBrainOwnership.orchestration_mode,
    handoff_route: handoffRoute,
    capability_name: "run_final_polisher",
    generation_boundary: "post_generation",
    orchestration_owner: "ChatGPT",
    prose_generator: "ChatGPT",
    full_neural_orchestrator_used: false,
    external_brain_session_id: runId,
    writing_context_bundle_id: contextBundleId,
    ...(rawStoryIntegrity ? { raw_story_integrity: rawStoryIntegrity } : {}),
    capability_output: null,
    blocked: true,
    blocked_reason: reason,
    runtime_process_instance_id: getRuntimeProcessInstanceId(),
    trace: {
      trace_id: null,
      run_id: runId,
      module_name: "final_polisher",
      status: "not_executed",
      output_hash: null,
    },
    agent_run_status: run.status,
    mutation_guards: { ...safety },
    ...safety,
  };
}

export async function useChatgptOwnedExternalBrainCapability(capabilityName, input = {}, options = {}) {
  const wrapper = wrappers[capabilityName];
  if (!wrapper) throw new Error(`Unknown external brain capability: ${capabilityName}`);
  const runId = requiredText(sessionId(input), "external_brain_session_id");
  const contextBundleId = requiredText(bundleId(input), "writing_context_bundle_id");
  const run = await getAgentRun(runId, options);
  if (run.mode !== externalBrainOwnership.orchestration_mode) {
    throw new Error("agent_run_id is not a ChatGPT-owned external brain writing session.");
  }
  const context = await getGptWritingContextBundle(contextBundleId, options);
  const isFinalPolisher = capabilityName === "run_final_polisher";
  const generationBoundary = isFinalPolisher ? "post_generation" : "pre_generation";
  let rawStoryText = null;
  let declaredRawStorySha256 = null;
  let receivedRawStorySha256 = null;
  let sealedAcquisition = null;
  let handoffRoute = null;
  if (isFinalPolisher) {
    const sealedRouteRequested = input.raw_story_handoff_id !== undefined;
    const directRouteRequested = input.raw_story_text !== undefined
      || input.raw_story_sha256 !== undefined
      || input.raw_story_integrity_manifest !== undefined;
    if (sealedRouteRequested === directRouteRequested) {
      return blockedFinalPolisherResponse({
        run,
        runId,
        contextBundleId,
        handoffRoute: sealedRouteRequested ? "invalid_mixed_handoff_routes" : "missing_handoff_route",
        reason: sealedRouteRequested
          ? "raw_story_handoff_id is mutually exclusive with raw_story_text, raw_story_sha256, and raw_story_integrity_manifest; final_polisher was not executed."
          : "Choose exactly one final-polisher handoff route: direct raw_story_text plus raw_story_sha256, or raw_story_handoff_id; final_polisher was not executed.",
      });
    }
    if (sealedRouteRequested) {
      handoffRoute = "single_ingress_immutable_seal";
      try {
        sealedAcquisition = await acquireRawStoryHandoff({
          raw_story_handoff_id: input.raw_story_handoff_id,
          run_id: runId,
          writing_context_bundle_id: contextBundleId,
        }, options);
      } catch (error) {
        return blockedFinalPolisherResponse({
          run,
          runId,
          contextBundleId,
          handoffRoute,
          reason: `${error instanceof Error ? error.message : String(error)} final_polisher was not executed.`,
          rawStoryIntegrity: {
            guard_used: true,
            integrity_route: handoffRoute,
            status: "blocked",
            raw_story_handoff_id: input.raw_story_handoff_id ?? null,
            exact_match: false,
            blocked_stage: "raw_story_handoff_seal_resolution",
            final_polisher_executed: false,
          },
        });
      }
      rawStoryText = sealedAcquisition.raw_story_text;
      receivedRawStorySha256 = sha256(rawStoryText);
      const tripleHashExactMatch = sealedAcquisition.seal_ingress_raw_story_sha256
        === sealedAcquisition.parent_broker_received_raw_story_sha256
        && sealedAcquisition.parent_broker_received_raw_story_sha256 === sealedAcquisition.raw_story_sha256
        && sealedAcquisition.raw_story_sha256 === receivedRawStorySha256;
      if (!tripleHashExactMatch) {
        await releaseRawStoryHandoffAcquisition(sealedAcquisition, options);
        return blockedFinalPolisherResponse({
          run,
          runId,
          contextBundleId,
          handoffRoute,
          reason: "The process-local sealed payload no longer matches its immutable exact SHA-256; final_polisher was not executed.",
          rawStoryIntegrity: {
            guard_used: true,
            integrity_route: handoffRoute,
            status: "mismatch",
            raw_story_handoff_id: sealedAcquisition.raw_story_handoff_id,
            seal_received_raw_story_sha256: sealedAcquisition.raw_story_sha256,
            seal_ingress_raw_story_sha256: sealedAcquisition.seal_ingress_raw_story_sha256,
            parent_broker_received_raw_story_sha256: sealedAcquisition.parent_broker_received_raw_story_sha256,
            final_polisher_resolved_raw_story_sha256: receivedRawStorySha256,
            triple_hash_exact_match: false,
            exact_match: false,
            blocked_stage: "raw_story_handoff_integrity",
            final_polisher_executed: false,
          },
        });
      }
    } else {
      handoffRoute = "direct_exact_sha256";
      try {
        rawStoryText = requiredText(input.raw_story_text, "raw_story_text");
      } catch (error) {
        return blockedFinalPolisherResponse({
          run,
          runId,
          contextBundleId,
          handoffRoute,
          reason: `${error instanceof Error ? error.message : String(error)}; final_polisher was not executed.`,
        });
      }
      declaredRawStorySha256 = input.raw_story_sha256;
      receivedRawStorySha256 = sha256(rawStoryText);
    }
  }
  if (isFinalPolisher && handoffRoute === "direct_exact_sha256") {
    const declaredFormatValid = validSha256(declaredRawStorySha256);
    const exactMatch = declaredFormatValid && declaredRawStorySha256 === receivedRawStorySha256;
    const declaredIntegrityManifest = input.raw_story_integrity_manifest;
    if (declaredIntegrityManifest !== undefined && declaredFormatValid) {
      validateRawStoryIntegrityManifest(declaredIntegrityManifest, {
        declared_raw_story_sha256: declaredRawStorySha256,
      });
    }
    if (!exactMatch) {
      const integrityStatus = declaredFormatValid ? "mismatch" : "invalid_declared_hash";
      const forensics = declaredFormatValid
        ? buildRawStoryMismatchForensics({
          declared_manifest: declaredIntegrityManifest,
          declared_raw_story_sha256: declaredRawStorySha256,
          received_raw_story_text: rawStoryText,
        })
        : null;
      return {
        ok: false,
        tool_name: "chatgpt_bridge_use_final_polisher",
        architecture_route: externalBrainOwnership.orchestration_mode,
        handoff_route: handoffRoute,
        capability_name: capabilityName,
        generation_boundary: generationBoundary,
        orchestration_owner: "ChatGPT",
        prose_generator: "ChatGPT",
        full_neural_orchestrator_used: false,
        external_brain_session_id: runId,
        writing_context_bundle_id: contextBundleId,
        raw_story_integrity: {
          guard_used: true,
          status: integrityStatus,
          declared_raw_story_sha256: declaredFormatValid ? declaredRawStorySha256 : declaredRawStorySha256 ?? null,
          received_raw_story_sha256: receivedRawStorySha256,
          exact_match: false,
          blocked_stage: "raw_story_handoff_integrity",
          final_polisher_executed: false,
          ...(forensics ? { forensics } : {}),
        },
        capability_output: null,
        blocked: true,
        blocked_reason: declaredFormatValid
          ? "raw_story_handoff_integrity mismatch: declared raw_story_sha256 does not match the exact received raw_story_text; final_polisher was not executed."
          : "raw_story_sha256 is required and must be exactly 64 lowercase hexadecimal characters; final_polisher was not executed.",
        trace: {
          trace_id: null,
          run_id: runId,
          module_name: "final_polisher",
          status: "not_executed",
          output_hash: null,
        },
        agent_run_status: run.status,
        mutation_guards: { ...safety },
        ...safety,
      };
    }
  }
  if (isFinalPolisher) {
    const missing = await missingPreGenerationCapabilities(runId, options);
    if (missing.length) {
      if (sealedAcquisition) {
        await releaseRawStoryHandoffAcquisition(sealedAcquisition, options);
      }
      throw new Error(`final_polisher is post-generation and requires all pre-generation capabilities first: ${missing.join(", ")}.`);
    }
  }
  let techniqueSelection = null;
  let priorCognition = null;
  let expandedCharacterCanonGrounding = null;
  let expandedWorldEntityCanonGrounding = null;
  if (isFinalPolisher) {
    try {
      expandedCharacterCanonGrounding = await buildVerifiedGeneratedCastGrounding({
        context,
        rawStoryText,
        rawStorySha256: receivedRawStorySha256,
      });
      expandedWorldEntityCanonGrounding =
        await buildVerifiedGeneratedWorldEntityGrounding({
          context,
          rawStoryText,
          rawStorySha256: receivedRawStorySha256,
        });
    } catch (error) {
      if (sealedAcquisition) {
        await releaseRawStoryHandoffAcquisition(sealedAcquisition, options);
      }
      throw error;
    }
  }
  if (capabilityName === "run_writing_card_director") {
    priorCognition = await loadVerifiedPriorAuthorshipCognition({
      run_id: runId,
      writing_context_bundle_id: contextBundleId,
    }, options);
    if (!priorCognition.ok) {
      const missingText = priorCognition.missing_modules.length
        ? ` Missing prior cognition modules: ${priorCognition.missing_modules.join(", ")}.`
        : "";
      const integrityText = priorCognition.integrity_failures.length
        ? ` Invalid prior cognition sources: ${priorCognition.integrity_failures.map((failure) => `${failure.module_name} (${failure.code})`).join(", ")}.`
        : "";
      return blockedDirectorResponse({
        runId,
        contextBundleId,
        run,
        continuity: priorCognition,
        reason: `writing_card_director requires verified exact outputs from all five prior cognition modules.${missingText}${integrityText}`,
      });
    }
    try {
      techniqueSelection = resolveWritingTechniqueSelection(input.capability_input ?? {});
    } catch (error) {
      return blockedDirectorResponse({
        runId,
        contextBundleId,
        run,
        continuity: priorCognition,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }
  const directorPriorCognitionSources =
    capabilityName === "run_writing_card_director"
      ? (options.adapter === undefined
        ? buildDirectorPriorCognitionSurface(
          priorCognition.selected_sources,
        )
        : priorCognition.selected_sources.map((source) => ({
          module_name: source.module_name,
          trace_id: source.trace_id,
          output_hash: source.output_hash,
          result_type: source.result_type,
          capability_output: source.capability_output,
        })))
      : [];
  const capabilityInput = isFinalPolisher ? {
    module_name: capabilityName,
    generation_boundary: generationBoundary,
    raw_story_text: rawStoryText,
    raw_story_sha256: receivedRawStorySha256,
    ...(handoffRoute === "direct_exact_sha256" ? {
      declared_raw_story_sha256: declaredRawStorySha256,
    } : {
      raw_story_handoff_id: sealedAcquisition.raw_story_handoff_id,
      sealed_raw_story_sha256: sealedAcquisition.raw_story_sha256,
    }),
    writing_context_bundle_id: contextBundleId,
    pre_generation_character_canon_grounding:
      context.bundle.content?.character_canon_grounding ?? null,
    expanded_character_canon_grounding: expandedCharacterCanonGrounding,
    character_canon_grounding:
      expandedCharacterCanonGrounding
      ?? context.bundle.content?.character_canon_grounding
      ?? null,
    pre_generation_world_entity_canon_grounding:
      context.bundle.content?.world_entity_canon_grounding
      ?? null,
    expanded_world_entity_canon_grounding:
      expandedWorldEntityCanonGrounding,
    world_entity_canon_grounding:
      expandedWorldEntityCanonGrounding
      ?? context.bundle.content?.world_entity_canon_grounding
      ?? null,
    capability_input: input.capability_input ?? {},
  } : {
    module_name: capabilityName,
    generation_boundary: generationBoundary,
    task_prompt: context.bundle.task_prompt,
    writing_context_bundle_id: contextBundleId,
    writing_context: context.bundle,
    capability_input: input.capability_input ?? {},
    ...(capabilityName === "run_writing_card_director" ? {
      authorship_cognition_sources: {
        integration_mode: "same_author_cognition_synthesis",
        canonical_ordering: [...priorAuthorshipCognitionModules],
        source_manifest: priorCognition.selected_sources.map((source) => ({
          module_name: source.module_name,
          trace_id: source.trace_id,
          output_hash: source.output_hash,
          result_type: source.result_type,
        })),
        prior_cognition_outputs: directorPriorCognitionSources,
      },
    } : {}),
  };
  let execution;
  try {
    execution = await wrapper(capabilityInput, {
      run_id: runId,
      task_type: "draft_generation",
      source: "chatgpt_owned_external_brain_mcp",
      external_brain_cognition_output: priorAuthorshipCognitionModules.includes(capabilityName.slice(4)),
      story_material_cognition_output: shouldEnableStoryMaterialCognition(capabilityName, options),
      generation_surface_output:
        !isFinalPolisher
        && (options.generation_surface_output ?? options.adapter === undefined),
      writing_context_bundle_id: contextBundleId,
      adapter: options.adapter ?? deterministicAdapter(capabilityName, rawStoryText, {
        technique_selection: techniqueSelection,
      }),
      ...(options.fixtureRoot ? { fixtureRoot: options.fixtureRoot } : {}),
    });
  } catch (error) {
    if (sealedAcquisition) {
      await releaseRawStoryHandoffAcquisition(sealedAcquisition, options);
    }
    throw error;
  }
  const executionSucceeded = execution.trace?.status === "success";
  if (execution.trace?.trace_id) {
    await recordExternalBrainSessionActivity(runId, {
      activity_at: execution.trace.called_at ?? new Date().toISOString(),
      activity_source: `neural_trace:${execution.trace.trace_id}`,
    }, options);
  }
  if (sealedAcquisition) {
    if (executionSucceeded) {
      await completeRawStoryHandoffConsumption(sealedAcquisition, options);
    } else {
      await releaseRawStoryHandoffAcquisition(sealedAcquisition, options);
    }
  }
  const finalizedRun = isFinalPolisher && executionSucceeded
    ? await finalizeAgentRun(runId, { ...options, output: execution.output })
    : null;
  const lifecycleRun = finalizedRun
    ? await transitionExternalBrainSessionLifecycle(runId, "COMPLETED", {
      transitioned_at: execution.trace.called_at ?? new Date().toISOString(),
      activity_source: `final_polisher:${execution.trace.trace_id}`,
    }, options)
    : null;
  return {
    ok: executionSucceeded,
    tool_name: `chatgpt_bridge_use_${capabilityName.slice(4)}`,
    architecture_route: externalBrainOwnership.orchestration_mode,
    capability_name: capabilityName,
    generation_boundary: generationBoundary,
    orchestration_owner: "ChatGPT",
    prose_generator: "ChatGPT",
    full_neural_orchestrator_used: false,
    external_brain_session_id: runId,
    writing_context_bundle_id: contextBundleId,
    ...(isFinalPolisher ? {
      handoff_route: handoffRoute,
      raw_story_sha256: receivedRawStorySha256,
      raw_story_integrity: handoffRoute === "single_ingress_immutable_seal" ? {
        guard_used: true,
        integrity_route: handoffRoute,
        status: "matched",
        raw_story_handoff_id: sealedAcquisition.raw_story_handoff_id,
        seal_received_raw_story_sha256: sealedAcquisition.raw_story_sha256,
        seal_ingress_raw_story_sha256: sealedAcquisition.seal_ingress_raw_story_sha256,
        parent_broker_received_raw_story_sha256: sealedAcquisition.parent_broker_received_raw_story_sha256,
        final_polisher_resolved_raw_story_sha256: receivedRawStorySha256,
        triple_hash_exact_match: sealedAcquisition.seal_ingress_raw_story_sha256
          === sealedAcquisition.parent_broker_received_raw_story_sha256
          && sealedAcquisition.parent_broker_received_raw_story_sha256 === receivedRawStorySha256,
        exact_match: true,
        blocked_stage: null,
        final_polisher_executed: true,
        payload_reference_active: false,
        payload_release_semantics: "process_local_reference_released_not_secure_memory_erase",
      } : {
        guard_used: true,
        status: "matched",
        declared_raw_story_sha256: declaredRawStorySha256,
        received_raw_story_sha256: receivedRawStorySha256,
        exact_match: true,
        blocked_stage: null,
        final_polisher_executed: true,
      },
    } : {}),
    capability_output: execution.output,
    ...(!isFinalPolisher && execution.control_plane?.generation_surface_compacted ? {
      generation_surface: {
        used: true,
        full_cognition_retained: true,
        control_plane_excluded_from_capability_output: true,
      },
    } : {}),
    runtime_process_instance_id: getRuntimeProcessInstanceId(),
    ...(sealedAcquisition ? {
      final_polisher_child_runtime_process_instance_id: getRuntimeProcessInstanceId(),
      broker_runtime_process_instance_id: sealedAcquisition.broker_runtime_process_instance_id,
      broker_storage_scope: sealedAcquisition.broker_storage_scope,
      broker_persistence: sealedAcquisition.broker_persistence,
    } : {}),
    trace: {
      trace_id: execution.trace?.trace_id ?? null,
      run_id: execution.trace?.run_id ?? runId,
      module_name: execution.trace?.module_name ?? capabilityName.slice(4),
      status: execution.trace?.status ?? "failed",
      output_hash: execution.trace?.output_hash ?? null,
    },
    agent_run_status: finalizedRun?.status ?? run.status,
    session_lifecycle_status: lifecycleRun?.session_lifecycle_status
      ?? run.session_lifecycle_status
      ?? "ACTIVE",
    mutation_guards: { ...safety },
    ...safety,
  };
}
