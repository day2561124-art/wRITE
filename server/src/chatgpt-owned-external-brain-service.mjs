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
  getRuntimeProcessInstanceId,
} from "./raw-story-handoff-seal-service.mjs";
import { expandGeneratedCastCanonGrounding } from "./generated-cast-canon-grounding-service.mjs";
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
) {
  const story = requiredText(rawStoryText, "raw_story_text");
  const characterHardFacts = compactCharacterHardFacts(characterCanonGrounding);
  const generatedCharacterCount = characterCanonGrounding
    ?.generated_existing_canon_character_count ?? 0;
  const ambiguousMentions = characterCanonGrounding?.ambiguous_mentions ?? [];
  const originalOrUnresolvedMentions = characterCanonGrounding
    ?.original_or_unresolved_mentions ?? [];
  const entityGroundingRelevant = characterHardFacts.length > 0
    || ambiguousMentions.length > 0
    || originalOrUnresolvedMentions.length > 0;
  const originalEntityFreedom = entityGroundingRelevant
    ? characterCanonGrounding?.original_entity_freedom ?? null
    : null;
  const evidenceBinding = (requirement) => [{
    source: "raw_story_text",
    binding: "exact_passage_or_precise_location_required",
    requirement,
  }];
  const characterEvidenceBinding = (requirement) => [{
    source: "raw_story_text+expanded_character_canon_grounding",
    binding: "exact_passage_character_grounded_fact_and_provenance_required",
    requirement,
  }];
  return {
    result_type: "final_polisher_report",
    editorial_mode: "subtractive_whole_draft_review",
    raw_story_sha256: sha256(story),
    editorial_review_required_for_success: true,
    findings_review_mode: "requires_chatgpt_semantic_review",
    ...(characterHardFacts.length ? {
      character_canon_grounding_loaded: characterCanonGrounding?.loaded === true,
      character_canon_grounding_count: characterHardFacts.length,
      character_hard_facts: characterHardFacts,
    } : {}),
    ...(characterCanonGrounding?.expansion_metadata && entityGroundingRelevant ? {
      expanded_character_canon_grounding_loaded: characterCanonGrounding.loaded === true,
      pre_generation_character_count:
        characterCanonGrounding.pre_generation_character_count ?? 0,
      generated_existing_canon_character_count: generatedCharacterCount,
      generated_existing_canon_characters:
        characterCanonGrounding.generated_existing_canon_characters ?? [],
      ambiguous_canon_mentions: ambiguousMentions,
      original_or_unresolved_mentions: originalOrUnresolvedMentions,
      generated_cast_expansion: characterCanonGrounding.expansion_metadata,
    } : {}),
    ...(originalEntityFreedom ? {
      original_entity_freedom: originalEntityFreedom,
      editorial_entity_rules: [
        "Canon absence alone is not an editorial defect and never requires deletion or approval.",
        "Do not silently reinterpret an original entity as a similarly named Canon entity.",
      ],
    } : {}),
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
      prohibited_defaults: ["prose_beautification", "adjective_augmentation", "sensory_detail_injection", "metaphor_generation"],
    },
    findings: [
      {
        code: "pattern_saturation",
        severity: "medium",
        evidence: evidenceBinding("Bind exact repeated occurrences and mark where their dramatic return diminishes."),
        diagnosis: "Check whether synchronization, reversals, punchline rhythms, or nearby sentence shapes have become over-saturated.",
        revision_action: "Retain the strongest occurrence; delete, compress, vary, or de-synchronize lower-yield repetition.",
        preserve: ["causal_continuity", "character_agency", "strongest_pattern_payoff"],
      },
      {
        code: "symmetry_overcompleted",
        severity: "medium",
        evidence: evidenceBinding("Bind exact mirrored beats and mark where the symmetry first becomes legible."),
        diagnosis: "Check whether later proof adds emotion or merely exposes design after the symmetry is complete.",
        revision_action: "Preserve the strongest mirror; delete, weaken, or de-synchronize weaker mirrors without damaging the core theme.",
        preserve: ["core_theme", "relationship_turn", "highest_value_mirror"],
      },
      {
        code: "callback_saturation",
        severity: "medium",
        evidence: evidenceBinding("Bind each callback to its source and state what new meaning the recurrence adds."),
        diagnosis: "Classify semantic, relationship, comic, and structural callbacks; check local density.",
        revision_action: "Remove weakest callbacks first; preserve those that change relationship, information, emotion, or scene meaning.",
        preserve: ["meaningful_payoff", "relationship_change", "chapter_turn"],
      },
      {
        code: "echo_only_callback",
        severity: "low",
        evidence: evidenceBinding("Quote source and recurrence; show that the recurrence adds no meaning."),
        diagnosis: "Check whether a repeated line, action, or image echoes rather than transforms its source.",
        revision_action: "Delete or compress echo-only recurrence while keeping meaning-bearing callbacks intact.",
        preserve: ["semantic_callback", "relationship_callback", "comic_callback", "structural_callback"],
      },
      {
        code: "author_hand_visible",
        severity: "high",
        evidence: evidenceBinding("Quote narration that proves a setting, ability, governance, symmetry, or callback rule."),
        diagnosis: "Check whether rule-proof narration exposes writing-card or governance machinery, including ability-shortcut proof.",
        revision_action: "Delete proof or let physical consequence, character load, and natural action carry the boundary.",
        preserve: ["canon_boundary", "ordinary_physical_result", "character_agency"],
      },
      {
        code: "strong_beat_dilution",
        severity: "high",
        evidence: evidenceBinding("Bind the exact strong line, pause, or silence and nearby beats competing with it."),
        diagnosis: "Check whether nearby cleverness or structural completion dilutes the emotional beat.",
        revision_action: "Reduce nearby low-value callbacks; add no explanatory narration and, when sufficient, only delete.",
        preserve: ["strong_emotional_beat", "silence", "character_unexplained_emotion"],
      },
      {
        code: "narrative_camera_template",
        severity: "high",
        evidence: evidenceBinding("Bind at least two exact passages or precise local sequences showing a material generative-camera sequence/cluster; a single word, gesture, or banned-word match is never sufficient."),
        diagnosis: "Check reused cinematic grammar lacking a legitimate entry source: character attention, deliberate narrator distance, legitimate transition, or causal need.",
        revision_action: "Reorder information, delete source-less establishing narration, admit environment through character action or attention, or preserve and clarify a legitimate narrator-led transition; never use synonym-only replacement.",
        preserve: ["focal_consciousness", "character_attention", "legitimate_narrator_distance", "legitimate_transition", "causal_continuity", "useful_environment"],
      },
      {
        code: "human_diction_friction",
        severity: "medium",
        evidence: evidenceBinding("Quote the exact passage where collocation, translationese, excessive formality, written-register drift, or Taiwan Traditional Chinese rhythm catches in normal reading."),
        diagnosis: "Distinguish genuine Taiwan Traditional Chinese diction friction from intentional character voice or local rhythm.",
        revision_action: "Make the minimum revision to smooth the exact passage; preserve character voice and original rhythm, and do not beautify.",
        preserve: ["character_voice", "original_rhythm", "traditional_chinese_usage"],
      },
      {
        code: "referent_and_spatial_ambiguity",
        severity: "medium",
        evidence: evidenceBinding("Quote the exact passage and identify the referent, actor, hand, position, or action relation that forces rereading."),
        diagnosis: "Check whether the reader can establish who acts or stays still, the relevant hand, and immediate action or position relations.",
        revision_action: "Use only the minimum information needed to remove ambiguity; do not add unnecessary spatial explanation.",
        preserve: ["scene_pace", "physical_continuity", "minimal_information"],
      },
      {
        code: "functional_overcompression",
        severity: "medium",
        evidence: evidenceBinding("Bind the exact chain where nearly every line advances a relationship, detail pays off, or supporting actor triggers a protagonist turn; distinguish density from over-optimization."),
        diagnosis: "Check whether optimizing dialogue, objects, supporting actors, callbacks, and details makes design more visible than ordinary life.",
        revision_action: "Never add filler, banter, sensory detail, or random objects to prove naturalness. Reduce the functional chain: remove immediate interpretation or needless payoff, let a minor beat end without callback, return a supporting actor to an ordinary concern, or stop making each reaction complete the previous line's dramatic job.",
        preserve: ["ordinary_behavior", "low_function_connection", "supporting_actor_independence", "causal_continuity"],
      },
      {
        code: "self_awareness_overcompleted",
        severity: "high",
        evidence: evidenceBinding("Bind exact explicit uncertainty, unresolved emotion, demonstrated confusion, or incomplete self-knowledge where articulation materially exceeds established awareness or conflicts with established voice or prior behavior."),
        diagnosis: "Precise articulation alone is not a defect, and healthy, mature, expressive characters are valid. Flag only awareness-threshold conflict, backstage understanding copied into ideal dialogue, or an ensemble repeatedly delivering the psychologically best line on cue.",
        revision_action: "Use minimal intervention and never invent or solve a true hidden motive. Unknown remains valid; weaken only the unsupported excess while preserving established voice and behavior.",
        preserve: ["unknown_motive", "character_irregularity", "behavioral_evidence", "relationship_continuity"],
      },
      ...(characterHardFacts.length ? [
        {
          code: "canon_character_identity_conflict",
          severity: "high",
          evidence: characterEvidenceBinding("Bind character, exact passage, and conflicting grounded identity fact."),
          diagnosis: "Check explicit gender, formal identity, and core relationship position against the same grounded character.",
          revision_action: "Minimally restore the grounded identity or relationship while preserving causality and agency.",
        },
        {
          code: "character_pronoun_consistency_conflict",
          severity: "high",
          evidence: characterEvidenceBinding("Bind character, grounded pronouns, and exact conflicting passage."),
          diagnosis: "Review semantic referents only when Canon gender is explicit; unrelated draft pronouns are not evidence.",
          revision_action: "Correct only the bound pronoun and dependent referent wording; preserve unrelated or quoted usage.",
        },
        {
          code: "unsupported_body_trait_invention",
          severity: "high",
          evidence: characterEvidenceBinding("Bind character, exact invented trait, and lack of high-authority support."),
          diagnosis: "Check unsupported animal ears, tails, horns, wings, scales, or other permanent body traits; unlisted does not prove absence.",
          revision_action: "Remove the unsupported trait and rebuild any local action causality that depended on it.",
        },
        {
          code: "appearance_fact_conflict",
          severity: "high",
          evidence: characterEvidenceBinding("Bind character, exact passage, and conflicting grounded appearance fact."),
          diagnosis: "Check direct replacement of explicit Canon appearance by shorthand or conflicting permanent appearance.",
          revision_action: "Minimally restore the grounded appearance without decorative addition or beautification.",
        },
      ] : []),
      ...(ambiguousMentions.length ? [{
        code: "existing_canon_entity_name_collision",
        severity: "high",
        evidence: characterEvidenceBinding("Bind exact passage, candidate Canon entity, collision context, and why identity confidence is insufficient."),
        diagnosis: "Check whether a school, organization, location, facility, or other non-character phrase was force-bound to a similarly named Canon character.",
        revision_action: "Correct the grounding or referent interpretation first; revise prose only when the prose itself remains materially ambiguous.",
      }] : []),
      ...(generatedCharacterCount ? [{
        code: "generated_existing_character_canon_conflict",
        severity: "high",
        evidence: characterEvidenceBinding("Bind newly grounded existing Canon character, exact passage, grounded hard fact, and conflict."),
        diagnosis: "Review a confidently identified existing Canon character who entered after pre-generation grounding against the supplemental hard facts.",
        revision_action: "Minimally restore the newly grounded established fact while preserving the character's lawful entrance, agency, and local causality.",
      }] : []),
    ],
    protected_beats: [{
      code: "strong_emotional_beat",
      selection_rule: "ChatGPT must bind protection to exact short lines, pauses, or silences in the supplied draft, including beats such as ‘沒有。’ when context gives them emotional weight.",
      protection: ["do_not_explain", "reduce_nearby_low_value_callbacks", "prefer_silence"],
    }],
    revision_priorities: [
      "Protect canon, causality, agency, chapter turn, and strong beats.",
      ...(characterHardFacts.length ? [
        "Resolve evidence-bound Canon character identity, pronoun, appearance, and unsupported body-trait conflicts before release.",
      ] : []),
      "Address high-severity exact evidence first; otherwise prefer subtractive editing.",
      "Preserve living irregularity; never apply findings mechanically or complete a theme.",
    ],
    final_revision_instruction: [
      "ChatGPT remains the final prose generator.",
      "Review the whole draft; revise only for material exact evidence.",
      "Preserve canon, causal continuity, character agency, the chapter turn, and strong emotional beats.",
      ...(characterHardFacts.length ? [
        "Use character-bound Canon grounding for identity, pronouns, appearance, and body traits; remove unsupported traits and repair any local action causality that depended on them.",
      ] : []),
      ...(originalEntityFreedom ? [
        "Protect established facts without restricting new creation: unmatched original entities are allowed, never auto-persisted, and never deleted merely for Canon absence.",
      ] : []),
      "Use natural human-written Traditional Chinese; remove AI narrative grammar only when sequence or cluster evidence exists, preserve unknowns, and prefer subtraction over beautification or theme completion.",
      "Do not mechanically apply every finding or add generic polish.",
      "When story-only output was requested, output only the final revised story prose.",
      "If no material editorial issue exists after review, release the original text unchanged.",
    ].join(" "),
  };
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
        ...buildFinalPolisherEditorialContract(rawStoryText, characterCanonGrounding),
      };
    }
    const semanticOutputs = {
      run_scene_planner: {
        result_type: "scene_plan",
        objective: taskPrompt,
        scene_beats: [
          "Enter through what a character is doing, being prevented from doing, misjudging, enduring, or caring about; do not default to a panoramic or cinematic establishing shot.",
          "Escalate through a character choice with a visible consequence.",
          "Close the movement on a readable turn that advances the chapter.",
        ],
        focal_attention: {
          focal_consciousness: "Identify the consciousness or deliberate narrator distance governing this local information flow.",
          attention_priority: "Prefer current attention, action, bodily load, and pressure when selecting local information.",
          perception_boundary: "Respect the chosen viewpoint without forcing strict limited POV across deliberate narrator distance, scene or time transitions, and multi-POV transitions.",
          ignored_information: "Let unattended facts remain absent when they have no character, narrative, transition, or causal reason to enter.",
          body_first_signals: "Let bodily load, reflex, pain, imbalance, breath, or interrupted motion register before a polished psychological explanation when the moment calls for it.",
          environment_entry_reason: "Question habitual cinematic establishing, not narrator-led transition: environment may enter through attention, action, pressure, deliberate narrative distance, transition, or causal need.",
        },
        precision_guard: "Reject precision added only to look concrete and lacking narrative, character, or causal source. Preserve precision required for combat causality, physical position, actionable distance, timing pressure, navigation, or canon.",
        continuity_anchor_present: Boolean(writingContext.content?.chapter_anchor),
      },
      run_character_simulator: {
        result_type: "character_simulation",
        dramatic_situation: taskPrompt,
        character_cognition: {
          self_story: "The reason the character believes about themself; it may organize behavior without being true.",
          misrecognized_motive: "A motive may be misnamed or misunderstood, but do not invent a corrected motive merely to complete the analysis.",
          avoided_question: "The character may not know the answer or even recognize that they are avoiding the question.",
          false_certainty: "A confident account can be wrong and can still drive a consequential choice.",
          behavioral_leak: "Speech and bodily action may temporarily disagree; behavior can leak pressure the character cannot accurately state.",
          awareness_threshold: "Set plausible awareness and articulation from established character voice, prior behavior, current knowledge, and current scene pressure; backstage cognition cannot bypass it.",
        },
        behavior_constraints: [
          "Let each character act from current knowledge, position, and relationship pressure.",
          "Carry tension through gesture, silence, hesitation, and subtext instead of queue-style dialogue.",
          "Preserve distinct character agency; do not flatten the ensemble into an operator voice.",
          "Latent or actual motive may remain unknown; never force a guessed true motive or convert backstage cognition into precise self-analysis.",
          "Do not make characters consistently describe their psychology, boundaries, or growth correctly; show later growth first through a different choice or action rather than a self-summary.",
          "Canon identity facts are hard constraints, not psychological suggestions; never reinterpret a known male character as female or vice versa for scene convenience.",
          "When Canon gender is explicit, keep Traditional Chinese third- and second-person pronouns consistent with the grounded character.",
          "Do not invent unsupported animal ears, tails, horns, wings, scales, or permanent body traits as emotional or visual shorthand.",
          "Character Voice Registry guidance cannot override Canon identity, appearance, relationship position, or explicit body traits.",
          "Grounded hard facts apply only to confidently matched existing Canon characters; possible original characters remain creatively open.",
          "Never borrow the nearest Canon character's gender, appearance, body traits, relationships, or identity for an unmatched or similarly named original character.",
        ],
        character_grounded_irregularity: {
          principle: "A character may depart from the most efficient, mature, or elegant dramatic response only in a way grounded in that person and moment.",
          sources: ["established_disposition", "current_attention", "current_knowledge", "mistaken_belief", "relationship_pressure", "bodily_load", "immediate_circumstance"],
          guard: "Human irregularity is not randomness and is not a menu of anti-AI behaviors; never insert irregularity merely to prove that a character feels human.",
        },
        voice_registry_loaded: writingContext.character_voice_registry_loaded === true,
        character_canon_grounding_loaded: characterCanonGrounding.loaded === true,
        character_canon_grounding_count: characterHardFacts.length,
        character_hard_facts: characterHardFacts,
        original_entity_freedom: characterCanonGrounding.original_entity_freedom ?? null,
      },
      run_neural_critic: {
        result_type: "neural_critique",
        critique_focus: taskPrompt,
        risks: [
          { code: "character_reaction_too_correct", question: "Does every character produce the reaction best suited to the scene instead of a personally limited, mistimed, or frictional response?" },
          { code: "self_awareness_overcompleted", question: "Does a character understand and accurately explain their real psychology too quickly?" },
          { code: "scene_function_overoptimization", question: "Is every beat unusually effective, relationship-advancing, and free of ordinary friction?" },
          { code: "supporting_actor_functionality", question: "Does a supporting character or bystander exist only to trigger another character's core dialogue or turn rather than retaining an ordinary concern?" },
          { code: "narrative_information_without_attention_source", question: "Is information placed only because the author wants it known, without a legitimate source in character attention, deliberate narrator distance, scene or time transition, multi-POV transition, or causal need? Check source-less placement; do not require every fact to be character-noticed." },
          { code: "character_gender_or_pronoun_conflict", question: "For a specifically grounded character with explicit gender, does an exact passage semantically bind that character to a conflicting third- or second-person Traditional Chinese pronoun? Do not treat every pronoun in the draft as referring to the same character." },
          { code: "unsupported_body_trait_invention", question: "Does an exact character-bound passage invent animal ears, tails, horns, wings, scales, or another permanent body trait unsupported by that character's Canon grounding and current higher-authority context?" },
          { code: "appearance_fact_conflict", question: "Does an exact character-bound passage directly replace or contradict an explicit grounded Canon appearance fact?" },
          { code: "canon_entity_name_collision", question: "Has a name occurrence been force-bound to a Canon character although its phrase indicates a school, organization, location, facility, or other non-character entity?" },
          { code: "original_entity_freedom_violation", question: "Has cognition treated a Canon-unmatched original character or world entity as prohibited merely because no Canon record exists?" },
          { code: "generated_existing_character_ungrounded", question: "Does the verified raw story introduce a confidently identifiable existing Canon character absent from pre-generation grounding and therefore needing supplemental hard facts before final review?" },
        ],
        standing_constraints: [
          "Avoid engineering, provider, workflow, and handoff language in story prose.",
          "Preserve causal continuity and do not invent unsupported canon facts.",
          "Do not require, manufacture, reverse-engineer, or optimize the scene around a theme, allegory, moral lesson, or thematic closure. Do not search for a chapter theme; natural meaning may emerge from characters and events.",
        ],
        character_canon_grounding_loaded: characterCanonGrounding.loaded === true,
        character_canon_grounding_count: characterHardFacts.length,
        character_hard_facts: characterHardFacts,
        original_entity_freedom: characterCanonGrounding.original_entity_freedom ?? null,
      },
      run_style_drift_detector: {
        result_type: "style_drift_report",
        target: taskPrompt,
        drift_risk: "monitor",
        detection_method: "Inspect reused narrative grammar, local sequence shape, cluster density, and repeated narrative jobs. This is not a banned-word list: no single word or isolated gesture establishes drift, and the detector judges sequence reuse rather than lexical avoidance.",
        narrative_camera_template_sequences: [
          "environment establishing shot → distant ambient sound → spatial filtering metaphor → character microreaction → short dialogue reveal",
          "light → hair → shadow → wind → clothing edge",
          "environment sentence → character raises eyes, pauses, or turns slightly → narrator confirms the preceding sensory sentence",
        ],
        cluster_cognition: [
          "Low-intensity microreaction repeatedly used as a camera bridge.",
          "Sensory statement immediately proved by a reaction beat.",
          "Repeated spatial-filter metaphor used to manufacture literary texture.",
          "Repeated environment → gesture → dialogue paragraph cadence.",
          "Ask ChatGPT directly: Are you once again using a generative camera trained to manufacture a novel-like texture to film the scene?（你是不是又在用受過小說質感訓練的生成式攝影機拍場景？）",
        ],
        rhythm_guidance: [
          "Sentence rhythm must follow the character's current attention and pressure.",
          "Do not force every paragraph into an environment → gesture → dialogue cadence.",
          "Vary scene entry and paragraph breathing according to the actual event and consciousness.",
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
          "Do not copy cognition field names, structures, or proof sentences into prose to demonstrate unknown motive, absence of an ability shortcut, focal consciousness, or a supporting character's independent purpose; cognition stays in the external brain and prose shows only the natural result.",
        ],
      },
      run_writing_card_director: {
        result_type: "writing_card_director_context",
        integration_mode: "same_author_cognition_synthesis",
        direction: taskPrompt,
        source_cognition_manifest: (
          capabilityInput.authorship_cognition_sources?.source_manifest ?? []
        ).map((source) => ({
          ...source,
          consumption_status: "verified_and_consumed",
        })),
        cognition_frame: "The prior cognition outputs are different cognitive passes of the same author, not independent authorities and not simultaneous prose directives.",
        integration_principles: {
          semantic_deduplication: "Merge repeated meaning without increasing prose weight merely because multiple modules mention the same cognition.",
          authority_arbitration: "Use source authority and confidence to protect established truth; low-confidence suggestions never override Canon.",
          conflict_arbitration: "Resolve conflicts through author judgment before drafting; do not put both sides into prose or split the difference by default.",
          attention_compression: "Form a compact author understanding containing only concerns material to this scene; do not active-monitor every available cognition while writing.",
          scene_constraint_reconstruction: "Understand the people, place, action, knowledge, misunderstanding, pressure, prohibited invention, and present movement as one scene rather than a module checklist.",
        },
        authority_precedence: {
          higher_authority: [
            "Canon hard facts and Canon DB",
            "Character Canon Grounding derived directly from the full active_engine source",
            "active_engine P0 hard constraints",
            "established causal continuity",
            "established character knowledge and state",
          ],
          lower_authority: [
            "Character Voice Registry supporting guidance",
            "visual-only references",
            "low-confidence Writing Card suggestions",
            "technique cognition",
            "optional scene opportunities",
            "speculative interpretations",
          ],
          rule: "Higher-authority truth outranks lower-authority suggestions. Never compromise Canon merely to preserve a suggestion.",
        },
        uncertainty_and_invention: {
          unknown_preservation: "Unknown is a valid author conclusion; a source asking that something remain unknown must not be completed by speculation.",
          unsupported_invention_rejection: "Reject or suppress unsupported secret answers, foreshadowing, crisis lines, motives, facts, or payoffs instead of finding a prose compromise.",
        },
        established_fact_protection: "Existing Canon hard facts remain authoritative for confidently matched existing entities.",
        original_entity_freedom: {
          contract: characterCanonGrounding.original_entity_freedom ?? null,
          rule: "GPT may create new characters and world entities whenever the scene or long-form development naturally calls for them.",
          canon_absence_rule: "No Canon match is not, by itself, an error or prohibition.",
          ambiguity_rule: "Ambiguous names remain unresolved instead of being force-bound to a Canon entity.",
          persistence_boundary: "Original prose entities are not automatically written into Canon, active_engine, candidate, adoption, activation, or settlement workflows.",
        },
        prose_attention_transition: {
          module_boundary_dissolution: "Module boundaries should dissolve before prose generation: stop tracking what each module said and return to one author understanding of the scene.",
          author_state: "I am the author. I understand this scene. Now write freely.",
          private_reasoning_policy: "Do not expose private chain-of-thought, a reasoning transcript, or an integration report to the user.",
        },
        final_prose_ownership: {
          owner: "ChatGPT",
          writer_workbench_role: "integrated_authorship_cognition_handoff",
          writer_workbench_generates_story_prose: false,
          story_only_output: "Emit only the story prose when story-only output is requested.",
        },
        director_notes: [
          "Write the people first; let the scene emerge through what interrupts, matters to, or is noticed by them.",
          "Prefer natural Traditional Chinese narrative flow over cinematic polish.",
          "Do not seek a theme, symbolic closure, or a quotable chapter statement unless the story naturally produces one.",
          "Characters do not need to understand themselves correctly, and supporting characters and bystanders retain independent ordinary concerns.",
          "Do not require every dialogue exchange to progress a relationship or every object, gesture, callback, and environmental detail to pay off.",
          "Keep the story moving when events demand movement, but do not optimize every beat for narrative efficiency.",
          "When story-only output is requested, begin with the chapter title or prose rather than a handoff summary.",
        ],
        technique_learning_principle: {
          rule: "Techniques are opt-in cognitive methods, never default simultaneous directives or prose-style imitation; ChatGPT owns selection.",
        },
        available_technique_families: [...availableWritingTechniqueFamilies],
        selected_technique_families: [...(runtimeCognition.technique_selection?.selected_technique_families ?? [])],
        active_technique_cognition: runtimeCognition.technique_selection?.active_technique_cognition ?? {},
        technique_selection_policy: {
          default_selection: "none",
          trigger: "Select a family only for a matching craft problem or opportunity in the current scene.",
          normal_limit: "No more than one or two technique families; never combine the full pool by default.",
          non_demonstration: "Never alter a scene merely to demonstrate a learned technique.",
          override_priority: "Character truth, canon, causal continuity, and natural Traditional Chinese override technique usage.",
        },
        writing_card_context: writingContext.content?.writing_card_director_context ?? null,
        character_canon_grounding_loaded: characterCanonGrounding.loaded === true,
        character_canon_grounding_count: characterHardFacts.length,
        character_hard_facts: characterHardFacts,
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
  if (isFinalPolisher) {
    try {
      expandedCharacterCanonGrounding = await buildVerifiedGeneratedCastGrounding({
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
        prior_cognition_outputs: priorCognition.selected_sources.map((source) => ({
          module_name: source.module_name,
          trace_id: source.trace_id,
          output_hash: source.output_hash,
          result_type: source.result_type,
          capability_output: source.capability_output,
        })),
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
