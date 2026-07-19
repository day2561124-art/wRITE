const generationSurfaceVersion = "phase50a-external-brain-generation-surface-v1";

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function compactString(value, maxChars = 320) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text ? text.slice(0, maxChars) : null;
}

function compactScalar(value, maxChars = 320) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return compactString(value, maxChars);
  if (typeof value === "number" || typeof value === "boolean") return value;
  return null;
}

function compactArray(value, { maxItems = 8, maxChars = 320 } = {}) {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, maxItems)
    .map((item) => {
      if (isObject(item)) return compactObject(item, { maxKeys: 10, maxItems: 6, maxChars });
      return compactScalar(item, maxChars);
    })
    .filter((item) => item !== null && item !== undefined && item !== "");
}

function compactObject(value, { maxKeys = 12, maxItems = 8, maxChars = 320 } = {}) {
  if (!isObject(value)) return null;
  const output = {};
  for (const [key, item] of Object.entries(value).slice(0, maxKeys)) {
    if (Array.isArray(item)) {
      const array = compactArray(item, { maxItems, maxChars });
      if (array.length) output[key] = array;
      continue;
    }
    if (isObject(item)) {
      const object = compactObject(item, { maxKeys, maxItems, maxChars });
      if (object && Object.keys(object).length) output[key] = object;
      continue;
    }
    const scalar = compactScalar(item, maxChars);
    if (scalar !== null && scalar !== "") output[key] = scalar;
  }
  return output;
}

function pick(source, keys) {
  const output = {};
  for (const key of keys) {
    if (!Object.hasOwn(source, key)) continue;
    const compacted = compactGenerationField(key, source[key]);
    if (Array.isArray(compacted)) {
      if (compacted.length) output[key] = compacted;
      continue;
    }
    if (isObject(compacted)) {
      if (Object.keys(compacted).length) output[key] = compacted;
      continue;
    }
    if (compacted !== null && compacted !== "") output[key] = compacted;
  }
  return output;
}

function compactCharacterHardFacts(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 12).map((fact) => compactObject({
    canonical_name: fact?.canonical_name,
    gender: fact?.gender,
    pronouns: fact?.pronouns,
    identity_facts: fact?.identity_facts,
    affiliation_facts: fact?.affiliation_facts,
    appearance_facts: fact?.appearance_facts,
    relationship_or_position_facts: fact?.relationship_or_position_facts,
    explicit_body_traits: fact?.explicit_body_traits,
    grounding_classification: fact?.grounding_classification,
    unsupported_body_trait_policy: fact?.unsupported_body_trait_policy,
  }, { maxKeys: 12, maxItems: 12, maxChars: 520 })).filter(Boolean);
}

function compactWorldEntityHardFacts(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 12).map((fact) => compactObject({
    canonical_name: fact?.canonical_name,
    entity_type: fact?.entity_type,
    facts: fact?.facts,
    grounding_classification: fact?.grounding_classification,
  }, { maxKeys: 6, maxItems: 8, maxChars: 720 })).filter(Boolean);
}

function compactGenerationField(key, value) {
  if (key === "character_hard_facts") return compactCharacterHardFacts(value);
  if (key === "world_entity_hard_facts") return compactWorldEntityHardFacts(value);
  if (key === "original_entity_freedom" && isObject(value)) {
    return compactObject(value, { maxKeys: 18, maxItems: 24, maxChars: 520 });
  }
  if (Array.isArray(value)) return compactArray(value);
  if (isObject(value)) return compactObject(value);
  return compactScalar(value);
}

const generationVisibleKeys = Object.freeze({
  scene_planner: Object.freeze([
    "result_type",
    "scene_now",
    "active_characters",
    "immediate_pressure",
    "next_natural_turn",
    "do_not_resolve",
    "uncertainty",
    "objective",
    "continuity_anchor_present",
  ]),
  character_simulator: Object.freeze([
    "result_type",
    "simulation_status",
    "character",
    "characters",
    "known",
    "guessed",
    "felt",
    "refuses_to_admit",
    "immediate_goal",
    "speech_ceiling",
    "next_turn_reaction",
    "uncertainty",
    "character_canon_grounding_loaded",
    "character_canon_grounding_count",
    "character_hard_facts",
    "original_entity_freedom",
    "world_entity_canon_grounding_loaded",
    "world_entity_canon_grounding_count",
    "world_entity_hard_facts",
  ]),
  neural_critic: Object.freeze([
    "result_type",
    "draft_evidence_status",
    "findings",
    "hard_risks",
    "critique_focus",
    "evidence_only",
    "hard_risk_scope",
    "character_canon_grounding_loaded",
    "character_canon_grounding_count",
    "character_hard_facts",
    "original_entity_freedom",
    "world_entity_canon_grounding_loaded",
    "world_entity_canon_grounding_count",
    "world_entity_hard_facts",
  ]),
  style_drift_detector: Object.freeze([
    "result_type",
    "draft_evidence_status",
    "pre_generation_status",
    "findings",
    "target",
    "evidence_only",
  ]),
  over_governance_detector: Object.freeze([
    "result_type",
    "findings",
    "target",
    "hard_boundary",
  ]),
  writing_card_director: Object.freeze([
    "result_type",
    "integration_mode",
    "generation_card",
    "scene_now",
    "active_characters",
    "immediate_pressure",
    "character_turn_states",
    "hard_continuity_constraints",
    "next_natural_turn",
    "dialogue_risks",
    "do_not_resolve",
    "uncertainties",
    "selected_technique_families",
    "active_technique_cognition",
    "control_plane_excluded",
    "source_modules_consumed",
    "governance_findings_present",
    "hard_authority",
    "arbitration_rule",
    "original_entity_freedom",
    "writing_card_context",
    "character_canon_grounding_loaded",
    "character_canon_grounding_count",
    "character_hard_facts",
    "world_entity_canon_grounding_loaded",
    "world_entity_canon_grounding_count",
    "world_entity_hard_facts",
  ]),
  final_polisher: null,
});

export function buildExternalBrainGenerationSurface(moduleName, fullOutput) {
  if (!isObject(fullOutput)) return fullOutput;
  if (moduleName === "final_polisher") return fullOutput;
  const keys = generationVisibleKeys[moduleName];
  if (!keys) return compactObject(fullOutput) ?? {};
  const capabilityOutput = pick(fullOutput, keys);
  return {
    generation_surface_version: generationSurfaceVersion,
    generation_surface_only: true,
    ...capabilityOutput,
  };
}

export function buildDirectorPriorCognitionSurface(selectedSources = []) {
  return selectedSources.map((source) => ({
    module_name: source.module_name,
    result_type: source.result_type,
    capability_output: buildExternalBrainGenerationSurface(
      source.module_name,
      source.capability_output,
    ),
  }));
}

export function isExternalBrainGenerationSurface(value) {
  return isObject(value)
    && value.generation_surface_version === generationSurfaceVersion
    && value.generation_surface_only === true;
}

export { generationSurfaceVersion };

function firstNonEmpty(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function sourceArray(...values) {
  for (const value of values) {
    if (Array.isArray(value)) return compactArray(value, { maxItems: 8, maxChars: 240 });
  }
  return [];
}

function contextObject(value) {
  return isObject(value) ? value : {};
}

function focusCharacters(writingContext = {}, capabilityInput = {}) {
  const generation = contextObject(
    writingContext.inputs?.generation_context
    ?? writingContext.content?.generation_context,
  );
  const retrieval = contextObject(
    writingContext.inputs?.retrieval_context
    ?? writingContext.content?.retrieval_context,
  );
  const characters = sourceArray(
    capabilityInput.active_characters,
    capabilityInput.focus_characters,
    generation.active_characters,
    generation.focus_characters,
    retrieval.active_characters,
    retrieval.focus_characters,
  );
  const singular = firstNonEmpty(
    capabilityInput.character,
    capabilityInput.character_name,
    capabilityInput.active_character,
  );
  if (singular) {
    const withoutSingular = characters.filter((item) => item !== singular);
    characters.splice(0, characters.length, singular, ...withoutSingular);
  }
  return characters.slice(0, 6);
}

function listFromMapOrArray(value, character) {
  if (Array.isArray(value)) return compactArray(value, { maxItems: 8, maxChars: 240 });
  if (isObject(value) && character && Array.isArray(value[character])) {
    return compactArray(value[character], { maxItems: 8, maxChars: 240 });
  }
  return [];
}

function scalarFromMapOrValue(value, character, maxChars = 320) {
  if (typeof value === "string") return compactString(value, maxChars);
  if (isObject(value) && character) return compactString(value[character], maxChars);
  return null;
}

function nextTurnReaction(capabilityInput, character) {
  const source = isObject(capabilityInput.next_turn_reaction)
    ? capabilityInput.next_turn_reaction
    : isObject(capabilityInput.next_turn_reactions) && character
      ? capabilityInput.next_turn_reactions[character]
      : {};
  const output = compactObject({
    trigger: firstNonEmpty(
      source?.trigger,
      capabilityInput.last_utterance,
      capabilityInput.previous_line,
    ),
    impulse: source?.impulse,
    likely_action: source?.likely_action,
    speakable_fragment: source?.speakable_fragment,
  }, { maxKeys: 4, maxItems: 4, maxChars: 240 }) ?? {};
  return output;
}

export function buildDeterministicScenePlan({
  taskPrompt = "",
  writingContext = {},
  capabilityInput = {},
} = {}) {
  const anchor = contextObject(writingContext.content?.chapter_anchor);
  const characters = focusCharacters(writingContext, capabilityInput);
  return {
    result_type: "scene_plan",
    scene_now: firstNonEmpty(
      capabilityInput.scene_now,
      anchor.current_event,
      anchor.scene_now,
      taskPrompt,
    ),
    active_characters: characters,
    immediate_pressure: firstNonEmpty(
      capabilityInput.immediate_pressure,
      anchor.unresolved_consequence,
      anchor.immediate_pressure,
    ),
    next_natural_turn: firstNonEmpty(
      capabilityInput.next_natural_turn,
      capabilityInput.next_turn,
    ),
    do_not_resolve: sourceArray(
      capabilityInput.do_not_resolve,
      anchor.do_not_resolve,
    ),
    uncertainty: sourceArray(
      capabilityInput.uncertainty,
      capabilityInput.uncertainties,
    ),
    continuity_anchor_present: Object.keys(anchor).length > 0,
  };
}

export function buildDeterministicCharacterSimulation({
  writingContext = {},
  capabilityInput = {},
} = {}) {
  const characters = focusCharacters(writingContext, capabilityInput);
  const character = characters[0] ?? null;
  const known = listFromMapOrArray(capabilityInput.known, character);
  const guessed = listFromMapOrArray(capabilityInput.guessed, character);
  const felt = listFromMapOrArray(capabilityInput.felt, character);
  const refusesToAdmit = listFromMapOrArray(
    capabilityInput.refuses_to_admit,
    character,
  );
  const reaction = nextTurnReaction(capabilityInput, character);
  const immediateGoal = scalarFromMapOrValue(
    capabilityInput.immediate_goal,
    character,
  );
  const speechCeiling = scalarFromMapOrValue(
    capabilityInput.speech_ceiling,
    character,
  );
  const uncertainty = listFromMapOrArray(
    capabilityInput.uncertainty ?? capabilityInput.uncertainties,
    character,
  );
  const hasTurnResult = Boolean(
    character
    && (reaction.likely_action || reaction.speakable_fragment),
  );
  if (!character) uncertainty.push("active character was not supplied for this turn");
  if (character && !hasTurnResult) {
    uncertainty.push("next-turn action or speakable fragment was not supplied");
  }
  return {
    result_type: "character_simulation",
    simulation_status: hasTurnResult
      ? "character_specific_next_turn_ready"
      : "insufficient_character_specific_input",
    character,
    ...(characters.length > 1 ? { characters } : {}),
    known,
    guessed,
    felt,
    refuses_to_admit: refusesToAdmit,
    immediate_goal: immediateGoal,
    speech_ceiling: speechCeiling,
    next_turn_reaction: reaction,
    uncertainty: [...new Set(uncertainty)].slice(0, 8),
  };
}

export function buildDeterministicNeuralCritique({
  taskPrompt = "",
  capabilityInput = {},
} = {}) {
  const draft = firstNonEmpty(
    capabilityInput.draft_text,
    capabilityInput.raw_draft_text,
  );
  return {
    result_type: "neural_critique",
    draft_evidence_status: draft ? "draft_available" : "not_available_pre_generation",
    findings: sourceArray(capabilityInput.findings),
    hard_risks: sourceArray(capabilityInput.hard_risks),
    critique_focus: taskPrompt,
    evidence_only: true,
    hard_risk_scope: [
      "canon",
      "causality",
      "identity",
      "character_state",
      "timeline",
      "explicit_user_requirement",
    ],
  };
}

export function buildDeterministicStyleDriftReport({
  taskPrompt = "",
  capabilityInput = {},
} = {}) {
  const draft = firstNonEmpty(
    capabilityInput.draft_text,
    capabilityInput.raw_draft_text,
  );
  return {
    result_type: "style_drift_report",
    draft_evidence_status: draft ? "draft_available" : "not_available_pre_generation",
    pre_generation_status: draft
      ? "draft_evidence_supplied"
      : "inactive_without_draft_evidence",
    findings: sourceArray(capabilityInput.findings),
    target: taskPrompt,
    evidence_only: true,
  };
}

export function buildDeterministicOverGovernanceReport({
  taskPrompt = "",
  capabilityInput = {},
} = {}) {
  return {
    result_type: "over_governance_report",
    findings: sourceArray(capabilityInput.findings),
    target: taskPrompt,
    hard_boundary: "Keep workflow and governance language out of story prose.",
  };
}

function priorOutput(priorOutputs, moduleName) {
  return priorOutputs.find((source) => source.module_name === moduleName)
    ?.capability_output ?? {};
}

export function buildDeterministicWritingCard({
  taskPrompt = "",
  capabilityInput = {},
  priorOutputs = [],
  selectedTechniqueFamilies = [],
  activeTechniqueCognition = {},
} = {}) {
  const scene = priorOutput(priorOutputs, "scene_planner");
  const character = priorOutput(priorOutputs, "character_simulator");
  const critic = priorOutput(priorOutputs, "neural_critic");
  const style = priorOutput(priorOutputs, "style_drift_detector");
  const governance = priorOutput(priorOutputs, "over_governance_detector");
  const dialogueRisks = [
    ...compactArray(critic.findings, { maxItems: 6, maxChars: 240 }),
    ...compactArray(style.findings, { maxItems: 6, maxChars: 240 }),
  ].slice(0, 8);
  const uncertainties = [
    ...compactArray(scene.uncertainty, { maxItems: 6, maxChars: 240 }),
    ...compactArray(character.uncertainty, { maxItems: 6, maxChars: 240 }),
  ].slice(0, 8);
  const generationCard = {
    scene_now: scene.scene_now ?? compactString(taskPrompt, 480),
    active_characters: scene.active_characters
      ?? character.characters
      ?? (character.character ? [character.character] : []),
    immediate_pressure: scene.immediate_pressure ?? null,
    character_turn_states: character.character ? [{
      character: character.character,
      known: character.known ?? [],
      guessed: character.guessed ?? [],
      felt: character.felt ?? [],
      refuses_to_admit: character.refuses_to_admit ?? [],
      immediate_goal: character.immediate_goal ?? null,
      speech_ceiling: character.speech_ceiling ?? null,
      next_turn_reaction: character.next_turn_reaction ?? {},
      uncertainty: character.uncertainty ?? [],
    }] : [],
    hard_continuity_constraints: sourceArray(
      capabilityInput.hard_continuity_constraints,
      capabilityInput.hard_constraints,
    ),
    next_natural_turn: scene.next_natural_turn ?? null,
    dialogue_risks: dialogueRisks,
    do_not_resolve: scene.do_not_resolve ?? [],
    uncertainties,
  };
  return {
    result_type: "writing_card_director_context",
    integration_mode: "same_author_cognition_synthesis",
    generation_card: compactObject(generationCard, {
      maxKeys: 10,
      maxItems: 8,
      maxChars: 480,
    }),
    ...(selectedTechniqueFamilies.length ? {
      selected_technique_families: [...selectedTechniqueFamilies],
      active_technique_cognition: compactObject(
        activeTechniqueCognition,
        { maxKeys: 2, maxItems: 8, maxChars: 240 },
      ),
    } : {}),
    control_plane_excluded: true,
    source_modules_consumed: priorOutputs.map((source) => source.module_name),
    governance_findings_present: Array.isArray(governance.findings)
      && governance.findings.length > 0,
  };
}
