export const characterTurnSimulationVersion = "phase50b-character-turn-simulation-v1";

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanText(value, maxChars = 360) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text ? Array.from(text).slice(0, maxChars).join("") : null;
}

function object(value) {
  return isObject(value) ? value : {};
}

function uniqueStrings(values, { maxItems = 8, maxChars = 280 } = {}) {
  const seen = new Set();
  const output = [];
  for (const raw of values.flat(Infinity)) {
    const value = cleanText(
      typeof raw === "string" ? raw : null,
      maxChars,
    );
    if (!value) continue;
    const key = value.toLocaleLowerCase("zh-Hant-TW");
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(value);
    if (output.length >= maxItems) break;
  }
  return output;
}

function list(value, options) {
  return uniqueStrings(Array.isArray(value) ? value : [], options);
}

function firstText(...values) {
  for (const value of values) {
    const text = cleanText(value);
    if (text) return text;
  }
  return null;
}

function namedValue(value, character) {
  if (!character || !isObject(value)) return null;
  if (Object.hasOwn(value, character)) return value[character];
  const normalized = character.toLocaleLowerCase("zh-Hant-TW");
  for (const [key, candidate] of Object.entries(value)) {
    if (String(key).trim().toLocaleLowerCase("zh-Hant-TW") === normalized) {
      return candidate;
    }
  }
  return null;
}

function listFromValue(value, character, options) {
  if (Array.isArray(value)) return list(value, options);
  const selected = namedValue(value, character);
  return Array.isArray(selected) ? list(selected, options) : [];
}

function textFromValue(value, character, maxChars = 360) {
  if (typeof value === "string") return cleanText(value, maxChars);
  const selected = namedValue(value, character);
  return cleanText(selected, maxChars);
}

function contextGeneration(writingContext) {
  return object(
    writingContext?.inputs?.generation_context
      ?? writingContext?.content?.generation_context
      ?? writingContext?.materials?.generation_context,
  );
}

function contextRetrieval(writingContext) {
  return object(
    writingContext?.inputs?.retrieval_context
      ?? writingContext?.content?.retrieval_context
      ?? writingContext?.materials?.retrieval_context,
  );
}

function contextAnchor(writingContext) {
  return object(
    writingContext?.content?.chapter_anchor
      ?? writingContext?.materials?.chapter_anchor,
  );
}

function characterNamesFromValue(value) {
  if (typeof value === "string") return [value];
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item === "string") return [item];
    const entry = object(item);
    return [
      entry.character,
      entry.character_name,
      entry.characterName,
      entry.canonical_name,
      entry.name,
    ].filter(Boolean);
  });
}

function focusCharacters(writingContext, capabilityInput) {
  const generation = contextGeneration(writingContext);
  const retrieval = contextRetrieval(writingContext);
  const explicit = firstText(
    capabilityInput.character,
    capabilityInput.character_name,
    capabilityInput.responding_character,
    capabilityInput.active_character,
  );
  const names = uniqueStrings([
    ...(explicit ? [explicit] : []),
    ...characterNamesFromValue(capabilityInput.active_characters),
    ...characterNamesFromValue(capabilityInput.focus_characters),
    ...characterNamesFromValue(generation.active_characters),
    ...characterNamesFromValue(generation.focus_characters),
    ...characterNamesFromValue(retrieval.active_characters),
    ...characterNamesFromValue(retrieval.focus_characters),
  ], { maxItems: 6, maxChars: 120 });
  return names;
}

function targetFromTaskPrompt(taskPrompt) {
  const text = cleanText(taskPrompt, 12_000);
  if (!text) return null;
  const patterns = [
    /(?:只|僅)?模擬\s*([^\s，。、「」『』]{1,24}?)\s*(?:的)?下一(?:回合|步|反應)/u,
    /(?:讓|由)\s*([^\s，。、「」『』]{1,24}?)\s*(?:先)?回應/u,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const candidate = cleanText(match?.[1], 120);
    if (candidate) return candidate;
  }
  return null;
}

function lastQuotedUtterance(taskPrompt) {
  const text = cleanText(taskPrompt, 12_000);
  if (!text) return null;
  const quoted = [];
  for (const match of text.matchAll(/[「『“"]([^」』”"]{1,280})[」』”"]/gu)) {
    const value = cleanText(match[1], 280);
    if (value) quoted.push(value);
  }
  if (quoted.length) return quoted.at(-1);
  const labelled = [];
  for (const match of text.matchAll(/(?:^|[\s，。！？；：])[^\s，。！？；：]{1,24}[：:]\s*([^\n，。！？；]{1,280})/gu)) {
    const value = cleanText(match[1], 280);
    if (value) labelled.push(value);
  }
  return labelled.at(-1) ?? null;
}

function stateEntries(value) {
  if (Array.isArray(value)) return value.filter(isObject);
  if (!isObject(value)) return [];
  return Object.entries(value).map(([name, entry]) => (
    isObject(entry) ? { character_name: name, ...entry } : null
  )).filter(Boolean);
}

function stateName(entry) {
  return firstText(
    entry.character,
    entry.character_name,
    entry.characterName,
    entry.canonical_name,
    entry.name,
  );
}

function matchingState(value, character) {
  if (!character) return null;
  if (isObject(value)) {
    const direct = namedValue(value, character);
    if (isObject(direct)) return direct;
  }
  const normalized = character.toLocaleLowerCase("zh-Hant-TW");
  return stateEntries(value).find((entry) => (
    stateName(entry)?.toLocaleLowerCase("zh-Hant-TW") === normalized
  )) ?? null;
}

function ledgerState(value, character) {
  if (!isObject(value)) return null;
  return matchingState(value.characters, character);
}

function resolveCharacterState(writingContext, capabilityInput, character) {
  const generation = contextGeneration(writingContext);
  const retrieval = contextRetrieval(writingContext);
  const content = object(
    writingContext?.content
      ?? writingContext?.materials,
  );
  const candidates = [
    { label: "capability_input.character_state", value: capabilityInput.character_state },
    { label: "capability_input.character_turn_state", value: capabilityInput.character_turn_state },
    { label: "capability_input.character_states", value: matchingState(capabilityInput.character_states, character) },
    { label: "capability_input.character_turn_states", value: matchingState(capabilityInput.character_turn_states, character) },
    { label: "capability_input.mind_states", value: matchingState(capabilityInput.mind_states, character) },
    { label: "capability_input.character_mind_state_ledger", value: ledgerState(capabilityInput.character_mind_state_ledger, character) },
    { label: "generation_context.character_state", value: generation.character_state },
    { label: "generation_context.character_states", value: matchingState(generation.character_states, character) },
    { label: "generation_context.character_turn_states", value: matchingState(generation.character_turn_states, character) },
    { label: "generation_context.mind_states", value: matchingState(generation.mind_states, character) },
    { label: "generation_context.character_mind_state_ledger", value: ledgerState(generation.character_mind_state_ledger, character) },
    { label: "retrieval_context.character_states", value: matchingState(retrieval.character_states, character) },
    { label: "writing_context.character_mind_state_ledger", value: ledgerState(content.character_mind_state_ledger, character) },
  ];
  const merged = {};
  const sources = [];
  for (const candidate of candidates.reverse()) {
    if (!isObject(candidate.value)) continue;
    Object.assign(merged, candidate.value);
    sources.unshift(candidate.label);
  }
  return {
    state: merged,
    sources: uniqueStrings(sources, { maxItems: 8, maxChars: 120 }),
  };
}

function reactionInput(capabilityInput, character) {
  if (isObject(capabilityInput.next_turn_reaction)) {
    return capabilityInput.next_turn_reaction;
  }
  const selected = namedValue(capabilityInput.next_turn_reactions, character);
  return isObject(selected) ? selected : {};
}

function includesAny(values, pattern) {
  return values.some((value) => pattern.test(value));
}

function deriveImmediateGoal({
  explicitGoal,
  state,
  visibleActions,
  trigger,
  pressure,
  unspokenPressure,
}) {
  if (explicitGoal) return { value: explicitGoal, derived: false, source: "explicit" };
  const stateGoal = firstText(
    state.immediate_goal,
    state.current_goal,
    state.currentGoal,
    state.short_term_goal,
    state.wants,
    state.avoidance_goal,
  );
  if (stateGoal) return { value: stateGoal, derived: true, source: "character_state" };
  if (visibleActions.length) {
    return {
      value: `先完成「${visibleActions[0]}」，只處理眼前這一回合`,
      derived: true,
      source: "visible_reaction",
    };
  }
  if (unspokenPressure) {
    return {
      value: `先處理「${unspokenPressure}」造成的眼前拉扯，不在這一回合完成後果`,
      derived: true,
      source: "unspoken_pressure",
    };
  }
  if (pressure) {
    return {
      value: "先承受眼前壓力並維持當下立場，不在這一回合處理完整後果",
      derived: true,
      source: "scene_pressure",
    };
  }
  if (trigger) {
    return {
      value: "先回應眼前刺激，不擴大承諾或補完整段關係",
      derived: true,
      source: "turn_trigger",
    };
  }
  return { value: null, derived: false, source: null };
}

function deriveSpeechCeiling({ explicitCeiling, state, refusesToAdmit, guessed, trigger }) {
  if (explicitCeiling) return { value: explicitCeiling, derived: false, source: "explicit" };
  const stateCeiling = firstText(
    state.speech_ceiling,
    state.dialogue_ceiling,
    state.voice_boundary,
    state.speaking_limit,
  );
  if (stateCeiling) return { value: stateCeiling, derived: true, source: "character_state" };
  if (refusesToAdmit.length) {
    return {
      value: "只允許有限回應；不得直接說出保留內容，也不得用一句話完成坦白或和解",
      derived: true,
      source: "withheld_content",
    };
  }
  if (guessed.length) {
    return {
      value: "只能表達當下反應；不得把猜測說成已知事實",
      derived: true,
      source: "knowledge_boundary",
    };
  }
  if (trigger) {
    return {
      value: "只回應眼前一句；不補寫未提供的內心、因果或完整立場",
      derived: true,
      source: "turn_trigger",
    };
  }
  return { value: null, derived: false, source: null };
}

function reactionProfile({ felt, bodyState, immediateGoal, visibleActions }) {
  const emotional = felt.join("；");
  const goal = immediateGoal ?? "";
  const body = bodyState ?? "";
  if (visibleActions.length) {
    return {
      impulse: "先做出最小且可見的反應",
      likely_action: visibleActions[0],
      speech_act: /沉默|停頓|不說/u.test(visibleActions[0]) ? "暫不作答" : "有限回應",
      source: "visible_reactions_allowed",
    };
  }
  if (/(傷|痛|疲|虛弱|暈|失血|呼吸|僵硬)/u.test(body)) {
    return {
      impulse: "先穩住身體，再決定是否回應",
      likely_action: "先調整呼吸或姿勢，回應維持短促",
      speech_act: "短答或暫停",
      source: "body_state",
    };
  }
  if (/(心虛|愧疚|羞|難堪|後悔)/u.test(emotional)) {
    return {
      impulse: "想補救，但先壓住完整解釋",
      likely_action: "短暫停頓，視線或手部先避開對方",
      speech_act: "迴避式短答",
      source: "felt",
    };
  }
  if (/(害怕|恐懼|不安|警戒|焦躁|緊張|戒備)/u.test(emotional)) {
    return {
      impulse: "先確認威脅與退路",
      likely_action: "先確認距離或周遭，再給出最小回應",
      speech_act: "警戒式短答",
      source: "felt",
    };
  }
  if (/(生氣|憤怒|惱|不滿|煩躁)/u.test(emotional)) {
    return {
      impulse: "想反擊，但先控制第一個衝動",
      likely_action: "先收緊動作或語氣，不立刻把衝突說到底",
      speech_act: "截斷式回應",
      source: "felt",
    };
  }
  if (/(委屈|難過|失落|悲傷|受傷)/u.test(emotional)) {
    return {
      impulse: "想退開或沉默",
      likely_action: "先停住回應，讓情緒留在表情或動作上",
      speech_act: "暫不作答",
      source: "felt",
    };
  }
  if (/(避|拖|隱瞞|保持距離|不回答|先不|迴避)/u.test(goal)) {
    return {
      impulse: "收住第一個完整解釋",
      likely_action: "先延遲正面回答，用最小動作維持距離",
      speech_act: "迴避式短答",
      source: "immediate_goal",
    };
  }
  if (/(靠近|道歉|安撫|補救|承認|確認)/u.test(goal)) {
    return {
      impulse: "想靠近或補救，但不一次說完",
      likely_action: "先給出一個有限承認或靠近動作，不完成和解",
      speech_act: "有限承認",
      source: "immediate_goal",
    };
  }
  return {
    impulse: "先做出一個最小可見反應",
    likely_action: "先以一個動作或短答回應眼前刺激，不推進到下一場",
    speech_act: "最小回應",
    source: "turn_default",
  };
}

function withheldConflict(fragment, refusesToAdmit) {
  const text = cleanText(fragment, 320);
  if (!text || !refusesToAdmit.length) return false;
  // A concrete line can accidentally paraphrase withheld content even when no
  // exact substring matches. Keep the simulator at speech-act level whenever
  // refuses_to_admit is active; ChatGPT may later author a safe line under the
  // declared speech ceiling.
  return true;
}

function matchingHardFacts(characterHardFacts, character) {
  if (!character || !Array.isArray(characterHardFacts)) return [];
  const normalized = character.toLocaleLowerCase("zh-Hant-TW");
  return characterHardFacts.filter((fact) => (
    cleanText(fact?.canonical_name, 120)?.toLocaleLowerCase("zh-Hant-TW") === normalized
  ));
}

export function buildCharacterTurnSimulation({
  taskPrompt = "",
  writingContext = {},
  capabilityInput = {},
  characterHardFacts = [],
} = {}) {
  const generation = contextGeneration(writingContext);
  const anchor = contextAnchor(writingContext);
  const characters = focusCharacters(writingContext, capabilityInput);
  const explicitTarget = firstText(
    capabilityInput.character,
    capabilityInput.character_name,
    capabilityInput.responding_character,
    capabilityInput.active_character,
  );
  const promptTarget = targetFromTaskPrompt(taskPrompt);
  const character = explicitTarget ?? promptTarget ?? characters[0] ?? null;
  if (character && !characters.includes(character)) characters.unshift(character);

  const { state, sources: stateSources } = resolveCharacterState(
    writingContext,
    capabilityInput,
    character,
  );
  const explicitReaction = reactionInput(capabilityInput, character);
  const trigger = firstText(
    explicitReaction.trigger,
    capabilityInput.last_utterance,
    capabilityInput.previous_line,
    capabilityInput.trigger,
    generation.last_utterance,
    generation.previous_line,
    lastQuotedUtterance(taskPrompt),
  );
  const pressure = firstText(
    capabilityInput.immediate_pressure,
    generation.immediate_pressure,
    anchor.unresolved_consequence,
    anchor.immediate_pressure,
  );

  const known = uniqueStrings([
    listFromValue(capabilityInput.known, character),
    listFromValue(capabilityInput.known_facts, character),
    list(state.known),
    list(state.known_facts),
    list(state.observed_facts),
    list(state.recent_event_traces, { maxItems: 4, maxChars: 260 }),
  ], { maxItems: 10, maxChars: 280 });

  const rawGuessed = uniqueStrings([
    listFromValue(capabilityInput.guessed, character),
    listFromValue(capabilityInput.assumptions, character),
    list(state.guessed),
    list(state.assumptions),
    list(state.inferences),
  ], { maxItems: 8, maxChars: 280 });
  const knownKeys = new Set(known.map((item) => item.toLocaleLowerCase("zh-Hant-TW")));
  const guessed = rawGuessed.filter((item) => !knownKeys.has(item.toLocaleLowerCase("zh-Hant-TW")));

  const currentEmotion = firstText(
    textFromValue(capabilityInput.current_emotion, character),
    textFromValue(capabilityInput.emotion, character),
    state.current_emotion,
    state.currentEmotion,
    state.emotion,
  );
  const bodyState = firstText(
    textFromValue(capabilityInput.body_state, character),
    state.body_state,
    state.bodyState,
    state.physical_state,
  );
  const unspokenPressure = firstText(
    textFromValue(capabilityInput.unspoken_pressure, character),
    state.unspoken_pressure,
    state.unspokenPressure,
  );
  const felt = uniqueStrings([
    listFromValue(capabilityInput.felt, character),
    list(state.felt),
    currentEmotion ? [currentEmotion] : [],
    bodyState ? [`身體：${bodyState}`] : [],
  ], { maxItems: 8, maxChars: 280 });

  const refusesToAdmit = uniqueStrings([
    listFromValue(capabilityInput.refuses_to_admit, character),
    list(state.refuses_to_admit),
    list(state.hidden_reactions_reserved),
    list(state.withheld_content),
  ], { maxItems: 8, maxChars: 280 });

  const visibleActions = uniqueStrings([
    listFromValue(capabilityInput.visible_reactions_allowed, character),
    list(state.visible_reactions_allowed),
    list(state.allowed_next_actions),
  ], { maxItems: 6, maxChars: 240 });

  const immediateGoalResult = deriveImmediateGoal({
    explicitGoal: textFromValue(capabilityInput.immediate_goal, character),
    state,
    visibleActions,
    trigger,
    pressure,
    unspokenPressure,
  });
  const speechCeilingResult = deriveSpeechCeiling({
    explicitCeiling: textFromValue(capabilityInput.speech_ceiling, character),
    state,
    refusesToAdmit,
    guessed,
    trigger,
  });

  const suppliedLikelyAction = firstText(explicitReaction.likely_action);
  const suppliedSpeakableFragment = firstText(explicitReaction.speakable_fragment);
  const hasTurnEvidence = Boolean(
    trigger
    || pressure
    || unspokenPressure
    || known.length
    || guessed.length
    || felt.length
    || refusesToAdmit.length
    || visibleActions.length
    || immediateGoalResult.value
    || speechCeilingResult.value
    || suppliedLikelyAction
    || suppliedSpeakableFragment
    || explicitReaction.impulse
    || explicitReaction.speech_act
  );
  const profile = hasTurnEvidence ? reactionProfile({
    felt,
    bodyState,
    immediateGoal: immediateGoalResult.value,
    visibleActions,
  }) : {
    impulse: null,
    likely_action: null,
    speech_act: null,
    source: "insufficient_evidence",
  };
  const speakableConflict = withheldConflict(
    suppliedSpeakableFragment,
    refusesToAdmit,
  );
  const acceptedSpeakableFragment = speakableConflict
    ? null
    : suppliedSpeakableFragment;
  const nextTurnReaction = {
    trigger,
    impulse: firstText(explicitReaction.impulse, profile.impulse),
    likely_action: firstText(suppliedLikelyAction, profile.likely_action),
    speech_act: firstText(explicitReaction.speech_act, profile.speech_act),
    ...(acceptedSpeakableFragment
      ? { speakable_fragment: acceptedSpeakableFragment }
      : {}),
    stop_condition: "完成這一個可見動作或短答後停住；不得代替角色解決整個場景",
  };

  const uncertainty = uniqueStrings([
    listFromValue(
      capabilityInput.uncertainty ?? capabilityInput.uncertainties,
      character,
    ),
    list(state.uncertainty),
    list(state.continuity_constraints),
    !character ? ["active character was not supplied for this turn"] : [],
    !explicitTarget && !promptTarget && characters.length > 1
      ? ["target character was inferred from the first active character"]
      : [],
    rawGuessed.length !== guessed.length
      ? ["the same proposition was supplied as both known and guessed; the explicit known boundary was retained"]
      : [],
    speakableConflict
      ? ["a supplied speakable fragment revealed refuses_to_admit content and was removed"]
      : [],
    !stateSources.length
      ? ["no character-state record was supplied; only direct turn evidence was used"]
      : [],
  ], { maxItems: 10, maxChars: 320 });

  const hasExplicitTurn = Boolean(
    suppliedLikelyAction || acceptedSpeakableFragment || explicitReaction.speech_act,
  );
  const hasDerivedTurn = Boolean(character && nextTurnReaction.likely_action);
  const matchingCanon = matchingHardFacts(characterHardFacts, character);
  const derivedFields = [
    !hasExplicitTurn && nextTurnReaction.likely_action ? "next_turn_reaction" : null,
    immediateGoalResult.derived ? "immediate_goal" : null,
    speechCeilingResult.derived ? "speech_ceiling" : null,
    !explicitReaction.impulse ? "next_turn_reaction.impulse" : null,
    !explicitReaction.speech_act ? "next_turn_reaction.speech_act" : null,
  ].filter(Boolean);

  return {
    result_type: "character_simulation",
    simulation_version: characterTurnSimulationVersion,
    simulation_status: hasExplicitTurn
      ? "character_specific_next_turn_ready"
      : hasDerivedTurn
        ? "derived_character_specific_next_turn_ready"
        : "insufficient_character_specific_input",
    turn_scope: "single_next_turn_only",
    character,
    ...(characters.length > 1 ? { characters: characters.slice(0, 6) } : {}),
    known,
    guessed,
    felt,
    refuses_to_admit: refusesToAdmit,
    immediate_goal: immediateGoalResult.value,
    speech_ceiling: speechCeilingResult.value,
    next_turn_reaction: nextTurnReaction,
    uncertainty,
    knowledge_boundary: "guessed remains uncertain and is never promoted into known by the simulator",
    admission_boundary: "refuses_to_admit content cannot be emitted as dialogue or a speakable fragment",
    resolution_boundary: "simulate exactly one next turn; do not complete the scene, relationship arc, or conflict",
    simulation_basis: {
      target_resolution: explicitTarget
        ? "explicit_character"
        : promptTarget
          ? "task_prompt_target"
          : character
            ? "first_active_character_fallback"
            : "missing",
      trigger_source: explicitReaction.trigger
        ? "explicit_reaction"
        : capabilityInput.last_utterance || capabilityInput.previous_line
          ? "capability_input"
          : generation.last_utterance || generation.previous_line
            ? "generation_context"
            : trigger
              ? "task_prompt_dialogue"
              : "missing",
      character_state_sources: stateSources,
      explicit_fields: [
        ...((capabilityInput.known || capabilityInput.known_facts) ? ["known"] : []),
        ...((capabilityInput.guessed || capabilityInput.assumptions) ? ["guessed"] : []),
        ...(capabilityInput.felt ? ["felt"] : []),
        ...(capabilityInput.refuses_to_admit ? ["refuses_to_admit"] : []),
        ...(capabilityInput.immediate_goal ? ["immediate_goal"] : []),
        ...(capabilityInput.speech_ceiling ? ["speech_ceiling"] : []),
        ...(Object.keys(explicitReaction).length ? ["next_turn_reaction"] : []),
      ],
      derived_fields: derivedFields,
      reaction_source: suppliedLikelyAction ? "explicit" : profile.source,
      unspoken_pressure_used: Boolean(unspokenPressure),
      canon_constraint_count: matchingCanon.length,
      no_psychology_inferred_from_canon_identity_facts: true,
    },
  };
}

export default buildCharacterTurnSimulation;
