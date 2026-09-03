import {
  hashAgentRunValue,
} from "./agent-run-service.mjs";
import {
  buildWorldSimulationCharacterBrainInput,
} from "./world-simulation-character-brain-input-service.mjs";
import {
  adjudicateWorldSimulationCausality,
  buildWorldSimulationCausalRuleContract,
} from "./world-simulation-causal-rule-engine.mjs";
import {
  runWorldSimulationNativeCapability,
} from "./world-simulation-neural-service.mjs";
import {
  buildWorldSimulationVisibilityQueryContract,
  queryWorldSimulationObserverVisibility,
  worldSimulationVisibilityQueryVersion,
} from "./world-simulation-visibility-query-service.mjs";
import {
  buildWorldSimulationDirectionalHeightVisibilityContract,
  queryWorldSimulationObserverDirectionalHeightVisibility,
  worldSimulationDirectionalHeightVisibilityVersion,
} from "./world-simulation-directional-height-visibility-service.mjs";
import {
  buildWorldSimulationIlluminationVisibilityContract,
  queryWorldSimulationObserverIlluminationVisibility,
  worldSimulationIlluminationVisibilityVersion,
} from "./world-simulation-illumination-visibility-service.mjs";
import {
  buildWorldSimulationAudibilityQueryContract,
  queryWorldSimulationObserverAudibility,
  worldSimulationAudibilityQueryVersion,
} from "./world-simulation-audibility-query-service.mjs";
import {
  buildWorldSimulationChronologicalMutationQueue,
  executeWorldSimulationChronologicalMutationQueue,
} from "./world-simulation-chronological-mutation-queue-service.mjs";
import {
  buildWorldSimulationSubjectiveMemoryFormationContract,
  formWorldSimulationSubjectiveMemories,
  worldSimulationSubjectiveMemoryFormationVersion,
} from "./world-simulation-subjective-memory-formation-service.mjs";
import {
  buildWorldSimulationMemoryAccessibilityContract,
  queryWorldSimulationMemoryAccessibility,
  worldSimulationMemoryAccessibilityVersion,
} from "./world-simulation-memory-accessibility-service.mjs";
import {
  buildWorldSimulationRetrievalPracticeActivationProjectionContract,
  projectWorldSimulationRetrievalPracticeActivation,
} from "./world-simulation-retrieval-practice-activation-projection-service.mjs";
import {
  buildWorldSimulationBaseLevelActivationProjectionContract,
  projectWorldSimulationBaseLevelActivation,
} from "./world-simulation-base-level-activation-projection-service.mjs";
import {
  buildWorldSimulationCueDiagnosticEvidenceProjectionContract,
  projectWorldSimulationCueDiagnosticEvidence,
} from "./world-simulation-cue-diagnostic-evidence-projection-service.mjs";
import {
  buildWorldSimulationMemoryRetrievalProcessContract,
  buildWorldSimulationMemoryRetrievalQuery,
  executeWorldSimulationMemoryRetrievalProcess,
  worldSimulationMemoryRetrievalProcessVersion,
} from "./world-simulation-memory-retrieval-process-service.mjs";
import {
  buildWorldSimulationMemoryRetrievalProcessV3Contract,
  buildWorldSimulationMemoryRetrievalQueryV3,
  executeWorldSimulationMemoryRetrievalProcessV3,
  worldSimulationMemoryRetrievalProcessV3Version,
} from "./world-simulation-memory-retrieval-multistep-service.mjs";
import {
  buildWorldSimulationMemoryRetrievalPersistence,
  buildWorldSimulationMemoryRetrievalPersistenceContract,
  worldSimulationMemoryRetrievalPersistenceVersion,
} from "./world-simulation-memory-retrieval-persistence-service.mjs";
import {
  assertWorldSimulationSession,
} from "./world-simulation-session-service.mjs";
import {
  getStructuredEntityRegistry,
  normalizeEntityName,
} from "./structured-canon-entity-registry-service.mjs";
import {
  commitWorldSimulationTurn,
  getWorldSimulationHistory,
  getWorldSimulationState,
} from "./world-simulation-state-service.mjs";

export const worldSimulationLoopVersion = "phase62c-event-loop-v1";
export const worldSimulationCharacterRuntimeVersion = "character-runtime-v2";
export const worldSimulationCharacterExperienceContractVersion =
  "committed-character-experience-receipt-v1";
export const worldSimulationCharacterExperienceProjectionVersion =
  "committed-character-experience-projection-v1";
export const worldSimulationCharacterCurrentMindContractVersion =
  "character-current-mind-contract-v1";
export const worldSimulationCharacterAttentionReducerVersion =
  "deterministic-attention-reducer-v1";
export const worldSimulationCharacterCurrentMindProjectionVersion =
  "committed-character-current-mind-projection-v1";

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function object(value) {
  return isObject(value) ? value : {};
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function nonEmptyString(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} is required.`);
  }
  return value.trim();
}

function sameCharacterName(left, right) {
  return String(left ?? "").trim().toLocaleLowerCase("zh-Hant-TW")
    === String(right ?? "").trim().toLocaleLowerCase("zh-Hant-TW");
}

const currentMindPrivateKeys = new Set([
  "world_state",
  "scene_state",
  "source_position",
  "target_position",
  "exact_source_position",
  "exact_target_position",
  "relative_position",
  "distance_m",
  "target_illumination_lux",
  "received_level_db",
  "reference_level_db",
  "reference_distance_m",
  "minimum_audible_db",
  "observer_thresholds_lux",
  "causal_evidence",
  "causal_chain",
  "internal_provenance",
  "retrieval_cues",
  "encoded_at",
  "last_recalled_at",
]);

function keyIsCurrentMindPrivate(key) {
  const normalized = String(key ?? "").toLowerCase();
  return normalized === "id"
    || normalized.endsWith("_id")
    || normalized.endsWith("_ids")
    || normalized.startsWith("engine_")
    || normalized.startsWith("internal_")
    || normalized.includes("projection_hash")
    || normalized.includes("runtime")
    || currentMindPrivateKeys.has(normalized);
}

function sanitizeCurrentMindValue(value) {
  if (Array.isArray(value)) {
    return value.map(sanitizeCurrentMindValue);
  }
  if (!isObject(value)) return cloneJson(value);
  const clean = {};
  for (const [key, child] of Object.entries(value)) {
    if (keyIsCurrentMindPrivate(key)) continue;
    clean[key] = sanitizeCurrentMindValue(child);
  }
  return clean;
}

function currentMindText(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function currentMindStableText(value) {
  if (typeof value === "string") return value.trim().toLocaleLowerCase("zh-Hant-TW");
  return JSON.stringify(value ?? null).toLocaleLowerCase("zh-Hant-TW");
}

function currentMindSimulationTimeMs(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function currentMindExplicitRank(value, categories = {}) {
  if (value === true) return 2;
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value >= 0.75) return 3;
    if (value >= 0.4) return 2;
    if (value > 0) return 1;
    return 0;
  }
  const normalized = currentMindText(value)?.toLowerCase() ?? null;
  if (!normalized) return 0;
  return categories[normalized] ?? 1;
}

function currentMindGoalTexts(compatibilityState, currentAction) {
  const state = object(compatibilityState);
  return [
    ...array(state.goals),
    ...array(state.current_goals),
    state.current_goal,
    currentAction,
  ]
    .map((value) => currentMindText(typeof value === "string" ? value : null))
    .filter(Boolean);
}

function currentMindContentMatchesGoal(content, goals) {
  const contentText = currentMindStableText(content);
  if (!contentText || contentText === "null") return false;
  return goals.some((goal) => {
    const goalText = currentMindStableText(goal);
    if (!goalText || goalText.length < 2) return false;
    return contentText.includes(goalText) || goalText.includes(contentText);
  });
}

function currentMindExpectationApplies(
  expectation,
  selectedIntent = null,
  experiencedOutcome = null,
) {
  const expected = object(expectation);
  const actual = object(experiencedOutcome);
  const selected = object(selectedIntent);
  const expectedActionId = currentMindText(expected.action_id ?? null);
  const actualActionId = currentMindText(
    selected.action_id
    ?? actual.action_id
    ?? null,
  );
  if (expectedActionId) {
    if (!actualActionId
      || currentMindStableText(expectedActionId) !== currentMindStableText(actualActionId)) {
      return false;
    }
  }
  const expectedAction = currentMindText(
    expected.action
    ?? expected.intent
    ?? expected.action_intent
    ?? null,
  );
  const actualAction = currentMindText(
    selected.intent
    ?? actual.intent
    ?? actual.action
    ?? null,
  );
  if (expectedAction) {
    if (!actualAction
      || currentMindStableText(expectedAction) !== currentMindStableText(actualAction)) {
      return false;
    }
  }
  return Boolean(expectedActionId || expectedAction);
}

function currentMindExpectationMismatch(
  expectation,
  experiencedOutcome,
  selectedIntent = null,
) {
  if (!currentMindExpectationApplies(expectation, selectedIntent, experiencedOutcome)) {
    return false;
  }
  const expected = object(expectation);
  const actual = object(experiencedOutcome);
  const expectedResult = currentMindText(
    expected.expected_result
    ?? expected.expected_outcome
    ?? expected.expected
    ?? null,
  );
  const actualResult = currentMindText(
    actual.perceived_result
    ?? actual.result
    ?? actual.outcome
    ?? null,
  );
  if (!expectedResult || !actualResult) return false;
  return currentMindStableText(expectedResult) !== currentMindStableText(actualResult);
}

function currentMindInitialState() {
  return {
    current_mind_sequence: 0,
    simulation_time: null,
    focus: null,
    active_context: [],
    peripheral_context: [],
    fading_context: [],
    suspended_context: [],
    last_experience_sequence_integrated: 0,
    temporary_expectation: null,
  };
}

const currentMindCharacterHiddenMetadataKeys = new Set([
  "source_kind",
  "source_ref",
  "candidate_id",
  "attention_bids",
  "priority_evidence",
  "internal_priority_strength",
  "decay_metadata",
  "activated_at_sequence",
  "last_seen_sequence",
  "last_seen_simulation_time",
  "suspended_at_sequence",
  "suspension_reason",
  "salience",
  "perceptual_salience",
  "goal_relevance",
  "intention_relevance",
  "relevance",
  "urgency",
  "urgent",
  "immediate",
  "immediate_constraint",
  "threat_level",
  "expectation_violation",
  "unexpected",
  "expectation_met",
]);

function stripCurrentMindCharacterMetadata(value) {
  if (Array.isArray(value)) {
    return value.map(stripCurrentMindCharacterMetadata);
  }
  if (!isObject(value)) return cloneJson(value);
  const clean = {};
  for (const [key, child] of Object.entries(value)) {
    if (currentMindCharacterHiddenMetadataKeys.has(String(key).toLowerCase())) continue;
    clean[key] = stripCurrentMindCharacterMetadata(child);
  }
  return clean;
}

function sanitizeCurrentMindCharacterValue(value) {
  return stripCurrentMindCharacterMetadata(
    sanitizeCurrentMindValue(value),
  );
}

function currentMindCharacterItem(candidate) {
  if (!isObject(candidate)) return null;
  const contextOrigin = candidate.source_kind === "committed_experience"
    || candidate.source_kind === "committed_action_experience"
    ? "committed_experience"
    : null;
  return {
    ...(contextOrigin ? { context_origin: contextOrigin } : {}),
    content: sanitizeCurrentMindCharacterValue(candidate.content),
  };
}

function currentMindCharacterView(state) {
  const value = object(state);
  return {
    focus: currentMindCharacterItem(value.focus),
    active_context: array(value.active_context).map(currentMindCharacterItem).filter(Boolean),
    peripheral_context: array(value.peripheral_context).map(currentMindCharacterItem).filter(Boolean),
    fading_context: array(value.fading_context).map(currentMindCharacterItem).filter(Boolean),
    suspended_context: array(value.suspended_context).map(currentMindCharacterItem).filter(Boolean),
    temporary_expectation: sanitizeCurrentMindCharacterValue(value.temporary_expectation ?? null),
  };
}

function currentMindCandidate({
  sourceKind,
  content,
  activationOrder,
  currentMindSequence,
  simulationTime,
  sourceRef,
  rawEvidence = {},
  fresh = true,
  prior = null,
}) {
  const boundedContent = sanitizeCurrentMindValue(content);
  if (boundedContent === null || boundedContent === undefined) return null;
  if (isObject(boundedContent) && Object.keys(boundedContent).length === 0) return null;
  const candidateIdentityContent = sanitizeCurrentMindCharacterValue(boundedContent);
  const candidateId = prior?.candidate_id ?? `mind_candidate_${hashAgentRunValue({
    source_kind: sourceKind,
    content: candidateIdentityContent,
  }).slice(0, 24)}`;
  return {
    candidate_id: candidateId,
    source_kind: sourceKind,
    content: boundedContent,
    activation_order: activationOrder,
    activated_at_sequence: currentMindSequence,
    last_seen_sequence: fresh
      ? currentMindSequence
      : Number(prior?.last_seen_sequence ?? currentMindSequence - 1),
    last_seen_simulation_time: fresh
      ? simulationTime
      : prior?.last_seen_simulation_time ?? null,
    source_ref: sourceRef ? cloneJson(sourceRef) : cloneJson(prior?.source_ref ?? null),
    raw_evidence: cloneJson(rawEvidence),
    fresh: fresh === true,
  };
}

function currentMindDecayMetadata(candidate, currentMindSequence, simulationTime) {
  const sequenceAge = Math.max(
    0,
    currentMindSequence - Number(candidate?.last_seen_sequence ?? currentMindSequence),
  );
  const currentMs = currentMindSimulationTimeMs(simulationTime);
  const priorMs = currentMindSimulationTimeMs(candidate?.last_seen_simulation_time);
  const elapsedMs = currentMs !== null && priorMs !== null
    ? Math.max(0, currentMs - priorMs)
    : null;
  const simulationBands = elapsedMs === null ? 0 : Math.floor(elapsedMs / 300000);
  return {
    sequence_age: sequenceAge,
    simulation_elapsed_ms: elapsedMs,
    decay_units: Math.min(32, sequenceAge + simulationBands),
    basis: "committed_cognitive_sequence_plus_simulation_time",
    wall_clock_used: false,
  };
}

function currentMindPriorityEvidence(candidate, context) {
  const raw = object(candidate.raw_evidence);
  const sourceKind = candidate.source_kind;
  const perceptualSalience = sourceKind === "perception"
    ? Math.max(1, currentMindExplicitRank(
      raw.salience ?? raw.perceptual_salience,
      { low: 1, normal: 1, medium: 2, high: 3, critical: 3 },
    ))
    : currentMindExplicitRank(raw.salience ?? raw.perceptual_salience);
  const goalRelevance = sourceKind === "current_action"
    ? 3
    : Math.max(
      currentMindExplicitRank(
        raw.goal_relevance ?? raw.intention_relevance ?? raw.relevance,
        { low: 1, medium: 2, high: 3, critical: 3 },
      ),
      currentMindContentMatchesGoal(candidate.content, context.goal_texts) ? 2 : 0,
    );
  const expectationViolation = raw.expectation_violation === true
    || raw.unexpected === true
    || raw.expectation_met === false;
  const urgency = Math.max(
    currentMindExplicitRank(
      raw.urgency ?? raw.immediate_constraint ?? raw.threat_level,
      { low: 1, medium: 2, high: 3, critical: 4, immediate: 4 },
    ),
    raw.urgent === true || raw.immediate === true ? 3 : 0,
  );
  const focusContinuity = context.current_focus_id === candidate.candidate_id;
  const experienceSequence = Number(candidate?.source_ref?.experience_sequence ?? 0);
  const evidence = {
    perceptual_salience: perceptualSalience,
    goal_intention_relevance: goalRelevance,
    expectation_violation: expectationViolation,
    immediate_constraint_urgency: urgency,
    focus_continuity: focusContinuity,
    activation_order: candidate.activation_order,
    experience_sequence: Number.isSafeInteger(experienceSequence) ? experienceSequence : 0,
    stable_candidate_identity: candidate.candidate_id,
  };
  const priorityStrength = (
    urgency * 8
    + (expectationViolation ? 6 : 0)
    + goalRelevance * 3
    + perceptualSalience * 2
    + (candidate.fresh ? 1 : 0)
  );
  return {
    ...candidate,
    attention_bids: {
      perceptual_salience_process: perceptualSalience > 0
        ? { supported: true, level: perceptualSalience }
        : { supported: false, level: 0 },
      goal_intention_relevance_process: goalRelevance > 0
        ? { supported: true, level: goalRelevance }
        : { supported: false, level: 0 },
      expectation_violation_process: {
        supported: expectationViolation,
      },
      immediate_constraint_urgency_process: urgency > 0
        ? { supported: true, level: urgency }
        : { supported: false, level: 0 },
      focus_continuity_process: {
        supported: focusContinuity,
      },
    },
    priority_evidence: evidence,
    internal_priority_strength: priorityStrength,
  };
}

function currentMindCandidatePrecedes(left, right) {
  if (!right) return true;
  const leftEvidence = left.priority_evidence;
  const rightEvidence = right.priority_evidence;
  const dimensions = [
    [leftEvidence.immediate_constraint_urgency, rightEvidence.immediate_constraint_urgency],
    [Number(leftEvidence.expectation_violation), Number(rightEvidence.expectation_violation)],
    [leftEvidence.goal_intention_relevance, rightEvidence.goal_intention_relevance],
    [leftEvidence.perceptual_salience, rightEvidence.perceptual_salience],
    [Number(leftEvidence.focus_continuity), Number(rightEvidence.focus_continuity)],
    [leftEvidence.experience_sequence, rightEvidence.experience_sequence],
  ];
  for (const [leftValue, rightValue] of dimensions) {
    if (leftValue !== rightValue) return leftValue > rightValue;
  }
  if (leftEvidence.activation_order !== rightEvidence.activation_order) {
    return leftEvidence.activation_order < rightEvidence.activation_order;
  }
  return String(leftEvidence.stable_candidate_identity)
    < String(rightEvidence.stable_candidate_identity);
}

function currentMindUniqueCandidates(candidates) {
  const byId = new Map();
  for (const candidate of candidates.filter(Boolean)) {
    const existing = byId.get(candidate.candidate_id);
    if (!existing) {
      byId.set(candidate.candidate_id, candidate);
      continue;
    }
    const preferred = existing.fresh === true && candidate.fresh !== true
      ? existing
      : candidate;
    const secondary = preferred === existing ? candidate : existing;
    byId.set(candidate.candidate_id, {
      ...secondary,
      ...preferred,
      raw_evidence: {
        ...object(existing.raw_evidence),
        ...object(candidate.raw_evidence),
      },
      fresh: existing.fresh === true || candidate.fresh === true,
      activation_order: Math.min(existing.activation_order, candidate.activation_order),
    });
  }
  return [...byId.values()];
}

function currentMindSourceRef(kind, payload, extra = {}) {
  return {
    kind,
    content_hash: hashAgentRunValue(sanitizeCurrentMindValue(payload)),
    ...cloneJson(extra),
  };
}

function buildWorldSimulationCharacterCurrentMindTransition(input = {}) {
  const priorState = isObject(input.prior_current_mind)
    ? cloneJson(input.prior_current_mind)
    : currentMindInitialState();
  const currentMindSequence = Number(priorState.current_mind_sequence ?? 0) + 1;
  const simulationTime = input.simulation_time ?? null;
  const perception = object(input.perception);
  const recoveredMemories = array(input.recovered_memories);
  const compatibilityState = object(input.compatibility_state);
  const recentExperienceReceipts = array(input.recent_experience_receipts);
  const legacyAttentionBootstrap = Number(priorState.current_mind_sequence ?? 0) === 0
    ? compatibilityState.attention ?? null
    : null;
  const legacyExpectationBootstrap = Number(priorState.current_mind_sequence ?? 0) === 0
    ? compatibilityState.temporary_expectation
      ?? compatibilityState.expectation
      ?? null
    : null;
  const temporaryExpectation = sanitizeCurrentMindValue(
    priorState.temporary_expectation
    ?? legacyExpectationBootstrap
    ?? null,
  );
  let temporaryExpectationResolved = false;
  const goalTexts = currentMindGoalTexts(compatibilityState, input.current_action);
  const candidates = [];
  let activationOrder = 0;

  const addCandidate = (value) => {
    if (!value) return;
    candidates.push(value);
    activationOrder += 1;
  };

  for (const [sense, values] of [
    ["visual", array(perception.observed)],
    ["auditory", array(perception.audible)],
    ["other", array(perception.other_senses)],
  ]) {
    values.forEach((observation, senseIndex) => addCandidate(currentMindCandidate({
      sourceKind: "perception",
      content: observation,
      activationOrder,
      currentMindSequence,
      simulationTime,
      sourceRef: currentMindSourceRef("perception", observation, {
        sense,
        sense_index: senseIndex,
      }),
      rawEvidence: isObject(observation) ? observation : {},
    })));
  }

  recoveredMemories.forEach((memory, memoryIndex) => {
    const content = isObject(memory)
      ? memory.content ?? memory.memory ?? memory.summary ?? memory
      : memory;
    addCandidate(currentMindCandidate({
      sourceKind: "recovered_memory",
      content,
      activationOrder,
      currentMindSequence,
      simulationTime,
      sourceRef: currentMindSourceRef("recovered_memory", content, {
        recovery_index: memoryIndex,
      }),
      rawEvidence: isObject(memory) ? memory : {},
    }));
  });

  if (input.current_action !== null && input.current_action !== undefined) {
    addCandidate(currentMindCandidate({
      sourceKind: "current_action",
      content: input.current_action,
      activationOrder,
      currentMindSequence,
      simulationTime,
      sourceRef: currentMindSourceRef("current_action", input.current_action),
      rawEvidence: { intention_relevance: "high" },
    }));
  }

  if (legacyAttentionBootstrap !== null && legacyAttentionBootstrap !== undefined) {
    addCandidate(currentMindCandidate({
      sourceKind: "legacy_attention_seed",
      content: legacyAttentionBootstrap,
      activationOrder,
      currentMindSequence,
      simulationTime,
      sourceRef: currentMindSourceRef("legacy_attention_seed", legacyAttentionBootstrap),
      rawEvidence: { goal_relevance: "low" },
    }));
  }

  const lastIntegratedExperienceSequence = Number(
    priorState.last_experience_sequence_integrated ?? 0,
  );
  let integratedExperienceSequence = lastIntegratedExperienceSequence;
  for (const receipt of recentExperienceReceipts) {
    const experienceSequence = Number(receipt?.experience_sequence ?? 0);
    if (!Number.isSafeInteger(experienceSequence)
      || experienceSequence <= lastIntegratedExperienceSequence) {
      continue;
    }
    integratedExperienceSequence = Math.max(integratedExperienceSequence, experienceSequence);
    const experience = object(receipt.experience);
    const observation = object(experience.observation);
    for (const [sense, values] of [
      ["visual", array(observation.observed)],
      ["auditory", array(observation.audible)],
      ["other", array(observation.other_senses)],
    ]) {
      values.forEach((value, index) => addCandidate(currentMindCandidate({
        sourceKind: "committed_experience",
        content: value,
        activationOrder,
        currentMindSequence,
        simulationTime,
        sourceRef: currentMindSourceRef("committed_experience", value, {
          experience_sequence: experienceSequence,
          sense,
          sense_index: index,
        }),
        rawEvidence: isObject(value) ? value : {},
      })));
    }
    const selectedIntent = object(
      experience?.participation?.selected_intent,
    );
    for (const outcome of array(experience?.participation?.experienced_action_outcomes)) {
      const expectationMismatch = currentMindExpectationMismatch(
        temporaryExpectation,
        outcome,
        selectedIntent,
      );
      if (
        temporaryExpectation !== null
        && isObject(outcome)
        && currentMindExpectationApplies(
          temporaryExpectation,
          selectedIntent,
          outcome,
        )
      ) {
        const actualResult = currentMindText(
          outcome.perceived_result
          ?? outcome.result
          ?? outcome.outcome
          ?? null,
        );
        if (actualResult) temporaryExpectationResolved = true;
      }
      addCandidate(currentMindCandidate({
        sourceKind: "committed_action_experience",
        content: outcome,
        activationOrder,
        currentMindSequence,
        simulationTime,
        sourceRef: currentMindSourceRef("committed_action_experience", outcome, {
          experience_sequence: experienceSequence,
        }),
        rawEvidence: {
          ...(isObject(outcome) ? outcome : {}),
          expectation_violation: expectationMismatch,
        },
      }));
    }
  }

  const priorCandidates = [
    priorState.focus,
    ...array(priorState.active_context),
    ...array(priorState.peripheral_context),
    ...array(priorState.fading_context),
    ...array(priorState.suspended_context),
  ].filter(isObject);
  for (const priorCandidate of priorCandidates) {
    const decay = currentMindDecayMetadata(
      priorCandidate,
      currentMindSequence,
      simulationTime,
    );
    if (decay.decay_units > 8) continue;
    addCandidate(currentMindCandidate({
      sourceKind: priorCandidate.source_kind ?? "prior_current_mind",
      content: priorCandidate.content,
      activationOrder,
      currentMindSequence,
      simulationTime,
      sourceRef: priorCandidate.source_ref ?? null,
      rawEvidence: {},
      fresh: false,
      prior: priorCandidate,
    }));
  }

  const currentFocusId = priorState.focus?.candidate_id ?? null;
  const prioritized = currentMindUniqueCandidates(candidates).map((candidate) => (
    currentMindPriorityEvidence(candidate, {
      current_focus_id: currentFocusId,
      goal_texts: goalTexts,
    })
  ));
  const currentFocusCandidate = currentFocusId
    ? prioritized.find((candidate) => candidate.candidate_id === currentFocusId) ?? null
    : null;
  let strongestChallenger = null;
  for (const candidate of prioritized) {
    if (candidate.candidate_id === currentFocusId) continue;
    if (currentMindCandidatePrecedes(candidate, strongestChallenger)) {
      strongestChallenger = candidate;
    }
  }

  const focusRetentionBonus = 5;
  const switchingInterruptionCost = 2;
  let focus = currentFocusCandidate;
  let interrupted = false;
  let switchReason = "focus_continuity_retained";
  if (!focus) {
    focus = strongestChallenger;
    switchReason = focus ? "no_existing_focus" : "no_attention_candidate";
  } else if (strongestChallenger) {
    const retainedPriority = focus.internal_priority_strength + focusRetentionBonus;
    const challengerPriority = strongestChallenger.internal_priority_strength;
    if (challengerPriority > retainedPriority + switchingInterruptionCost) {
      focus = strongestChallenger;
      interrupted = true;
      switchReason = "challenger_exceeded_relative_retention_and_switching_cost";
    }
  }

  const activeContext = [];
  const peripheralContext = [];
  const fadingContext = [];
  const suspendedContext = [];
  const activeBudget = 8;
  const peripheralBudget = 12;
  const fadingBudget = 12;
  const suspendedBudget = 8;

  if (interrupted && currentFocusCandidate) {
    suspendedContext.push({
      ...cloneJson(currentFocusCandidate),
      suspended_at_sequence: currentMindSequence,
      suspension_reason: "attention_interruption",
    });
  }

  const priorSuspendedIds = new Set(
    array(priorState.suspended_context)
      .filter(isObject)
      .map((item) => item.candidate_id)
      .filter(Boolean),
  );
  for (const candidate of prioritized) {
    if (candidate.candidate_id === focus?.candidate_id) continue;
    if (suspendedContext.some((item) => item.candidate_id === candidate.candidate_id)) continue;
    if (priorSuspendedIds.has(candidate.candidate_id) && candidate.fresh !== true) continue;
    const evidence = candidate.priority_evidence;
    const decay = currentMindDecayMetadata(candidate, currentMindSequence, simulationTime);
    const stronglyActive = evidence.immediate_constraint_urgency > 0
      || evidence.expectation_violation
      || evidence.goal_intention_relevance > 0
      || evidence.perceptual_salience >= 2;
    if (candidate.fresh && stronglyActive && activeContext.length < activeBudget) {
      activeContext.push(candidate);
      continue;
    }
    if (candidate.fresh && peripheralContext.length < peripheralBudget) {
      peripheralContext.push(candidate);
      continue;
    }
    if (decay.decay_units <= 4 && fadingContext.length < fadingBudget) {
      fadingContext.push({
        ...candidate,
        decay_metadata: decay,
      });
    }
  }

  const reactivatedContextIds = new Set([
    ...activeContext,
    ...peripheralContext,
    ...fadingContext,
  ].map((item) => item.candidate_id).filter(Boolean));
  for (const priorSuspended of array(priorState.suspended_context)) {
    if (!isObject(priorSuspended)) continue;
    if (suspendedContext.some((item) => item.candidate_id === priorSuspended.candidate_id)) continue;
    if (focus?.candidate_id === priorSuspended.candidate_id) continue;
    if (reactivatedContextIds.has(priorSuspended.candidate_id)) continue;
    const decay = currentMindDecayMetadata(priorSuspended, currentMindSequence, simulationTime);
    if (decay.decay_units > 8 || suspendedContext.length >= suspendedBudget) continue;
    suspendedContext.push({
      ...cloneJson(priorSuspended),
      decay_metadata: decay,
    });
  }

  const stripPriorityInternals = (candidate) => {
    if (!candidate) return null;
    const detached = cloneJson(candidate);
    delete detached.attention_bids;
    delete detached.priority_evidence;
    delete detached.internal_priority_strength;
    delete detached.raw_evidence;
    delete detached.fresh;
    return detached;
  };
  const stateAfter = {
    current_mind_sequence: currentMindSequence,
    simulation_time: simulationTime,
    focus: stripPriorityInternals(focus),
    active_context: activeContext.map(stripPriorityInternals),
    peripheral_context: peripheralContext.map(stripPriorityInternals),
    fading_context: fadingContext.map(stripPriorityInternals),
    suspended_context: suspendedContext.map(stripPriorityInternals),
    last_experience_sequence_integrated: integratedExperienceSequence,
    temporary_expectation: cloneJson(
      temporaryExpectationResolved
        ? null
        : temporaryExpectation,
    ),
  };
  const characterView = currentMindCharacterView(stateAfter);
  const processingByCandidateId = new Map();
  if (stateAfter.focus?.candidate_id) processingByCandidateId.set(stateAfter.focus.candidate_id, "focus");
  for (const item of stateAfter.active_context) processingByCandidateId.set(item.candidate_id, "active");
  for (const item of stateAfter.peripheral_context) processingByCandidateId.set(item.candidate_id, "peripheral");
  for (const item of stateAfter.fading_context) processingByCandidateId.set(item.candidate_id, "fading");
  for (const item of stateAfter.suspended_context) processingByCandidateId.set(item.candidate_id, "suspended");
  const encodingEvidence = prioritized
    .filter((candidate) => candidate.source_kind === "perception")
    .map((candidate) => ({
      sense: candidate.source_ref?.sense ?? null,
      sense_index: candidate.source_ref?.sense_index ?? null,
      processing_level: processingByCandidateId.get(candidate.candidate_id) ?? "peripheral",
      goal_relevance: candidate.priority_evidence.goal_intention_relevance > 0,
      expectation_violation: candidate.priority_evidence.expectation_violation === true,
      immediate_constraint_or_urgency:
        candidate.priority_evidence.immediate_constraint_urgency > 0,
      interruption_state: interrupted
        && focus?.candidate_id === candidate.candidate_id
          ? "interrupted_previous_focus"
          : "none",
      memory_encoding_decision: "unspecified",
    }));

  const sourceRefs = prioritized
    .filter((candidate) => candidate.fresh && isObject(candidate.source_ref))
    .map((candidate) => cloneJson(candidate.source_ref));
  const sourceSnapshot = {
    perception: sanitizeCurrentMindValue(perception),
    recovered_memories: sanitizeCurrentMindValue(recoveredMemories),
    current_action: sanitizeCurrentMindValue(input.current_action ?? null),
    compatibility_attention: sanitizeCurrentMindValue(legacyAttentionBootstrap),
    compatibility_expectation: sanitizeCurrentMindValue(legacyExpectationBootstrap),
    compatibility_goals: sanitizeCurrentMindValue(goalTexts),
    prior_current_mind_sequence: Number(priorState.current_mind_sequence ?? 0),
    recent_experience_sequences: recentExperienceReceipts
      .map((receipt) => Number(receipt?.experience_sequence ?? 0))
      .filter((sequence) => Number.isSafeInteger(sequence) && sequence > 0),
  };
  const focusTransition = {
    from: currentMindCharacterItem(priorState.focus),
    to: currentMindCharacterItem(stateAfter.focus),
    interrupted,
    resolution_reason: switchReason,
  };
  const focusResolutionEvidence = focus
    ? {
        selected_candidate_source_kind: focus.source_kind,
        support_processes: Object.entries(focus.attention_bids)
          .filter(([, evidence]) => evidence?.supported === true)
          .map(([process]) => process),
        priority_evidence: cloneJson(focus.priority_evidence),
        interruption_occurred: interrupted,
        resolution_reason: switchReason,
      }
    : null;
  const projectionBody = {
    current_mind_contract_version: worldSimulationCharacterCurrentMindContractVersion,
    attention_reducer_version: worldSimulationCharacterAttentionReducerVersion,
    projection_version: worldSimulationCharacterCurrentMindProjectionVersion,
    historical_semantics_version: worldSimulationCharacterCurrentMindProjectionVersion,
    turn_id: nonEmptyString(input.turn_id, "current mind turn_id"),
    current_mind_sequence: currentMindSequence,
    world_lineage: nonEmptyString(input.world_lineage, "current mind world lineage"),
    character_entity_id: nonEmptyString(
      input.character_entity_id,
      "current mind character entity_id",
    ),
    canonical_name: input.canonical_name ?? input.character ?? null,
    identity_source: input.identity_source ?? null,
    formal_identity: input.formal_identity === true,
    character: input.character ?? input.canonical_name ?? null,
    simulation_time: simulationTime,
    source_refs: sourceRefs,
    source_snapshot_hash: hashAgentRunValue(sourceSnapshot),
    focus_transition: focusTransition,
    context_transition: {
      active_context_count: stateAfter.active_context.length,
      peripheral_context_count: stateAfter.peripheral_context.length,
      fading_context_count: stateAfter.fading_context.length,
      suspended_context_count: stateAfter.suspended_context.length,
    },
    reducer_state_after: cloneJson(stateAfter),
    character_view_after: cloneJson(characterView),
    encoding_evidence_hash: hashAgentRunValue(encodingEvidence),
    resolver_audit: {
      attention_processes: [
        "perceptual_salience",
        "goal_intention_relevance",
        "expectation_violation",
        "immediate_constraint_urgency",
        "focus_continuity",
      ],
      deterministic_pairwise_resolver: true,
      focus_resolution_evidence: cloneJson(focusResolutionEvidence),
      focus_retention_bonus: focusRetentionBonus,
      switching_interruption_cost: switchingInterruptionCost,
      simple_sort_score_focus_selection_used: false,
      asynchronous_codelet_race_used: false,
      random_tie_break_used: false,
      deterministic_tie_break_order: [
        "urgency",
        "expectation_violation",
        "goal_intention_relevance",
        "perceptual_salience",
        "focus_continuity",
        "experience_sequence",
        "activation_order",
        "stable_candidate_identity",
      ],
      decay_basis: "committed_cognitive_sequence_plus_simulation_time",
      wall_clock_decay_used: false,
      workspace_budget_is_engineering_bound_not_human_capacity_claim: true,
    },
    boundaries: {
      owner: "character_runtime",
      speculative_until_world_commit: true,
      world_truth_is_not_current_mind: true,
      character_experience_is_not_current_mind: true,
      current_mind_is_not_memory: true,
      full_world_state_included: false,
      hidden_causal_material_included: false,
      gpt_hidden_reasoning_included: false,
      character_brain_authors_projection: false,
      attention_focus_directly_controls_memory_encoding: false,
    },
  };
  projectionBody.transition_hash = hashAgentRunValue(projectionBody);

  return {
    projection: cloneJson(projectionBody),
    character_facing_attention: cloneJson(characterView),
    working_context: cloneJson({
      focus: characterView.focus,
      active_context: characterView.active_context,
      peripheral_context: characterView.peripheral_context,
      fading_context: characterView.fading_context,
      suspended_context: characterView.suspended_context,
    }),
    encoding_evidence: cloneJson(encodingEvidence),
    internal_attention_state: {
      bids: prioritized.map((candidate) => ({
        candidate_id: candidate.candidate_id,
        sources: Object.entries(candidate.attention_bids)
          .filter(([, evidence]) => evidence?.supported === true)
          .map(([process]) => process),
        priority_evidence: cloneJson(candidate.priority_evidence),
      })),
      focus_candidate_id: focus?.candidate_id ?? null,
      focus_transition: cloneJson(focusTransition),
      resolver_version: worldSimulationCharacterAttentionReducerVersion,
    },
  };
}

function verifyCharacterCurrentMindTransitionProjection(characterProjection) {
  if (!isObject(characterProjection)) {
    throw new Error("Committed Character Current Mind transition projection must be an object.");
  }
  const transitionHash = nonEmptyString(
    characterProjection.transition_hash,
    "committed character current mind transition hash",
  );
  const body = cloneJson(characterProjection);
  delete body.transition_hash;
  delete body.projection_slot;
  if (hashAgentRunValue(body) !== transitionHash) {
    const error = new Error("Committed Character Current Mind transition hash verification failed.");
    error.code = "WORLD_SIMULATION_CHARACTER_CURRENT_MIND_TRANSITION_HASH_MISMATCH";
    throw error;
  }
  return cloneJson(characterProjection);
}

function verifyCharacterCurrentMindProjectionEnvelope(projection) {
  if (!isObject(projection)) {
    throw new Error("Committed Character Current Mind projection must be an object.");
  }
  const projectionHash = nonEmptyString(
    projection.projection_hash,
    "committed character current mind projection hash",
  );
  const body = cloneJson(projection);
  delete body.projection_hash;
  if (hashAgentRunValue(body) !== projectionHash) {
    const error = new Error("Committed Character Current Mind projection hash verification failed.");
    error.code = "WORLD_SIMULATION_CHARACTER_CURRENT_MIND_PROJECTION_HASH_MISMATCH";
    throw error;
  }
  for (const characterProjection of array(projection.character_projections)) {
    verifyCharacterCurrentMindTransitionProjection(characterProjection);
  }
  return cloneJson(projection);
}

export function projectWorldSimulationCharacterCurrentMindTransitions(input = {}) {
  const preparedTurn = object(input.prepared_turn);
  const storedCurrentMindTransitions = array(
    preparedTurn.current_mind_transition_projections,
  );
  const characterProjections = array(preparedTurn.decision_packets).map((packet, projectionSlot) => {
    const storedTransition = storedCurrentMindTransitions.find(
      (item) => sameCharacterName(item?.character, packet?.character),
    );
    const projection = verifyCharacterCurrentMindTransitionProjection(
      storedTransition?.projection
      ?? packet?.current_mind_transition_projection,
    );
    if (!sameCharacterName(projection.character, packet?.character)) {
      const error = new Error("Current Mind transition character does not match decision packet character.");
      error.code = "WORLD_SIMULATION_CHARACTER_CURRENT_MIND_CHARACTER_MISMATCH";
      throw error;
    }
    return {
      ...projection,
      projection_slot: projectionSlot,
    };
  });
  const envelope = {
    current_mind_contract_version: worldSimulationCharacterCurrentMindContractVersion,
    attention_reducer_version: worldSimulationCharacterAttentionReducerVersion,
    projection_version: worldSimulationCharacterCurrentMindProjectionVersion,
    historical_semantics_version: worldSimulationCharacterCurrentMindProjectionVersion,
    turn_id: nonEmptyString(preparedTurn.turn_id, "prepared current mind turn_id"),
    character_projections: characterProjections,
    boundaries: {
      current_mind_owner: "character_runtime",
      historical_attention_semantics_immutable: true,
      replay_runs_current_attention_algorithm: false,
      replay_reasks_character_brain: false,
      full_world_state_stored_here: false,
      gpt_hidden_reasoning_stored_here: false,
    },
  };
  envelope.projection_hash = hashAgentRunValue(envelope);
  return cloneJson(envelope);
}

const strippedCharacterExperienceObservationKeys = new Set([
  "world_state",
  "scene_state",
  "source_position",
  "target_position",
  "exact_source_position",
  "exact_target_position",
  "relative_position",
  "distance_m",
  "target_illumination_lux",
  "received_level_db",
  "reference_level_db",
  "reference_distance_m",
  "minimum_audible_db",
  "observer_thresholds_lux",
  "causal_evidence",
  "causal_chain",
  "internal_provenance",
]);

function keyIsCharacterExperiencePrivate(key) {
  const normalized = String(key ?? "").toLowerCase();
  return normalized === "id"
    || normalized.endsWith("_id")
    || normalized.endsWith("_ids")
    || normalized.startsWith("engine_")
    || normalized.startsWith("internal_")
    || strippedCharacterExperienceObservationKeys.has(normalized);
}

function sanitizeCharacterExperienceObservationValue(value) {
  if (Array.isArray(value)) {
    return value.map(sanitizeCharacterExperienceObservationValue);
  }
  if (!isObject(value)) return cloneJson(value);
  const clean = {};
  for (const [key, child] of Object.entries(value)) {
    if (keyIsCharacterExperiencePrivate(key)) continue;
    clean[key] = sanitizeCharacterExperienceObservationValue(child);
  }
  return clean;
}

function boundedCharacterExperienceObservation(perception) {
  const source = object(perception);
  return {
    observed: sanitizeCharacterExperienceObservationValue(array(source.observed)),
    audible: sanitizeCharacterExperienceObservationValue(array(source.audible)),
    other_senses: sanitizeCharacterExperienceObservationValue(array(source.other_senses)),
    information_boundary: sanitizeCharacterExperienceObservationValue(
      object(source.information_boundary),
    ),
  };
}

function safeCharacterOutcomeScalar(value) {
  if (value === null || value === undefined) return null;
  if (["string", "number", "boolean"].includes(typeof value)) return cloneJson(value);
  return null;
}

function boundedOwnActionOutcome(outcome, selectedActionId) {
  const source = object(outcome);
  const boundedEvidence = object(
    source.character_experience
    ?? source.experience_for_actor,
  );
  const projected = {
    action_id: selectedActionId ?? null,
  };
  for (const key of ["performed", "perceived_result", "perceived_status"]) {
    if (!Object.hasOwn(boundedEvidence, key)) continue;
    const value = safeCharacterOutcomeScalar(boundedEvidence[key]);
    if (value !== null) projected[key] = value;
  }
  return Object.keys(projected).length > 1 ? projected : null;
}

function verifyCharacterExperienceProjectionEnvelope(projection) {
  if (!isObject(projection)) {
    throw new Error("Committed Character Experience projection must be an object.");
  }
  const projectionHash = nonEmptyString(
    projection.projection_hash,
    "committed character experience projection hash",
  );
  const body = cloneJson(projection);
  delete body.projection_hash;
  if (hashAgentRunValue(body) !== projectionHash) {
    const error = new Error("Committed Character Experience projection hash verification failed.");
    error.code = "WORLD_SIMULATION_CHARACTER_EXPERIENCE_PROJECTION_HASH_MISMATCH";
    throw error;
  }
  return cloneJson(projection);
}

function nextCommittedCharacterExperienceSequence(
  history,
  worldLineage,
  characterEntityId,
) {
  const sequences = [];
  for (const turn of array(history?.turns)) {
    const projection = turn?.committed_character_experience_projection;
    if (!isObject(projection)) continue;
    for (const characterProjection of array(projection.character_projections)) {
      if (characterProjection?.world_lineage !== worldLineage
        || characterProjection?.character_entity_id !== characterEntityId) {
        continue;
      }
      const sequence = Number(characterProjection.experience_sequence);
      if (!Number.isSafeInteger(sequence) || sequence < 1) {
        const error = new Error(
          `Committed Character Experience history contains an invalid sequence for ${characterEntityId}.`,
        );
        error.code = "WORLD_SIMULATION_CHARACTER_EXPERIENCE_HISTORY_SEQUENCE_INVALID";
        throw error;
      }
      sequences.push(sequence);
    }
  }
  sequences.sort((left, right) => left - right);
  for (let index = 0; index < sequences.length; index += 1) {
    const expected = index + 1;
    if (sequences[index] !== expected) {
      const error = new Error(
        `Committed Character Experience history sequence is not contiguous for ${characterEntityId}: expected ${expected}, found ${sequences[index]}.`,
      );
      error.code = "WORLD_SIMULATION_CHARACTER_EXPERIENCE_HISTORY_SEQUENCE_INVALID";
      throw error;
    }
  }
  return sequences.length + 1;
}

export function projectWorldSimulationCharacterExperienceEvidence(input = {}) {
  const preparedTurn = object(input.prepared_turn);
  const selected = array(input.selected_action_intents);
  const actionOutcomes = array(input.action_outcomes);
  const runtimeIdentities = array(input.runtime_identities);
  const characterProjections = array(preparedTurn.decision_packets).map((packet, projectionSlot) => {
    const character = nonEmptyString(packet?.character, "decision packet character");
    const runtimeIdentity = runtimeIdentities.find((item) => sameCharacterName(item?.character, character));
    if (!runtimeIdentity) {
      const error = new Error(`Committed Character Experience projection is missing Runtime identity for ${character}.`);
      error.code = "WORLD_SIMULATION_CHARACTER_EXPERIENCE_RUNTIME_IDENTITY_REQUIRED";
      throw error;
    }
    const worldLineage = nonEmptyString(
      runtimeIdentity.world_lineage,
      "committed character experience world lineage",
    );
    const characterEntityId = nonEmptyString(
      runtimeIdentity.character_entity_id,
      "committed character experience character entity_id",
    );
    const experienceSequence = Number(runtimeIdentity.experience_sequence);
    if (!Number.isSafeInteger(experienceSequence) || experienceSequence < 1) {
      const error = new Error(
        `Committed Character Experience sequence is invalid for ${character}.`,
      );
      error.code = "WORLD_SIMULATION_CHARACTER_EXPERIENCE_SEQUENCE_INVALID";
      throw error;
    }
    const ownSelection = selected.find((item) => sameCharacterName(item?.character, character)) ?? null;
    const participated = ownSelection?.selection === "candidate_action_intent";
    const observation = boundedCharacterExperienceObservation(packet?.perception);
    const ownActionOutcomes = participated
      ? actionOutcomes
        .filter((outcome) => sameCharacterName(outcome?.actor, character))
        .map((outcome) => boundedOwnActionOutcome(outcome, ownSelection.action_id ?? null))
        .filter(Boolean)
      : [];
    const observedSomething = observation.observed.length > 0
      || observation.audible.length > 0
      || observation.other_senses.length > 0;
    return {
      projection_slot: projectionSlot,
      experience_sequence: experienceSequence,
      world_lineage: worldLineage,
      character_entity_id: characterEntityId,
      canonical_name: runtimeIdentity.canonical_name ?? character,
      identity_source:
        runtimeIdentity.identity_source
        ?? "historical_committed_character_experience_projection",
      formal_identity: runtimeIdentity.formal_identity === true,
      character,
      experience: {
        roles: {
          participant: participated,
          observer: observedSomething,
        },
        participation: participated
          ? {
              selected_intent: {
                action_id: ownSelection.action_id ?? null,
                intent: ownSelection.intent ?? null,
              },
              experienced_action_outcomes: ownActionOutcomes,
              selected_intent_is_not_outcome: true,
            }
          : {
              selected_intent: null,
              experienced_action_outcomes: [],
              selected_intent_is_not_outcome: true,
            },
        observation,
      },
      boundaries: {
        source_is_bounded_character_information: true,
        raw_world_state_included: false,
        hidden_causal_chain_included: false,
        other_character_private_state_included: false,
        exact_engine_geometry_included: false,
        participant_intent_promoted_to_success: false,
        objective_action_result_auto_exposed: false,
        post_outcome_experience_requires_explicit_bounded_actor_evidence: true,
      },
    };
  });
  const projection = {
    experience_contract_version: worldSimulationCharacterExperienceContractVersion,
    projection_version: worldSimulationCharacterExperienceProjectionVersion,
    historical_semantics_version: worldSimulationCharacterExperienceProjectionVersion,
    turn_id: nonEmptyString(preparedTurn.turn_id, "prepared turn_id"),
    character_projections: characterProjections,
    boundaries: {
      objective_world_history_remains_source_of_truth: true,
      full_next_world_state_stored_here: false,
      replay_uses_stored_historical_projection: true,
      current_perception_engine_reinterpretation_required_for_replay: false,
      character_brain_authors_projection: false,
      character_brain_authors_receipt: false,
    },
  };
  projection.projection_hash = hashAgentRunValue(projection);
  return cloneJson(projection);
}

function buildCommittedCharacterExperienceReceipt({
  worldLineage,
  runtimeSnapshot,
  historyEntry,
  projectionEnvelope,
  characterProjection,
}) {
  const revision = Number(historyEntry?.revision_to);
  if (!Number.isSafeInteger(revision) || revision < 1) {
    throw new Error("Committed Character Experience receipt requires a committed revision.");
  }
  const committedTurnId = nonEmptyString(
    historyEntry?.turn_id,
    "committed character experience history turn_id",
  );
  if (projectionEnvelope?.turn_id !== committedTurnId) {
    const error = new Error(
      "Committed Character Experience projection turn_id does not match committed history.",
    );
    error.code = "WORLD_SIMULATION_CHARACTER_EXPERIENCE_TURN_MISMATCH";
    throw error;
  }
  const experienceSequence = Number(characterProjection?.experience_sequence);
  if (!Number.isSafeInteger(experienceSequence) || experienceSequence < 1) {
    const error = new Error("Committed Character Experience receipt sequence is invalid.");
    error.code = "WORLD_SIMULATION_CHARACTER_EXPERIENCE_SEQUENCE_INVALID";
    throw error;
  }
  const receiptIdentity = {
    world_lineage: worldLineage,
    committed_turn_id: committedTurnId,
    committed_revision: revision,
    character_entity_id: runtimeSnapshot.character_entity_id,
    projection_slot: characterProjection.projection_slot,
    experience_sequence: experienceSequence,
    experience_contract_version: projectionEnvelope.experience_contract_version,
    projection_version: projectionEnvelope.projection_version,
  };
  return {
    receipt_id: `character_experience_${hashAgentRunValue(receiptIdentity).slice(0, 28)}`,
    experience_contract_version: projectionEnvelope.experience_contract_version,
    projection_version: projectionEnvelope.projection_version,
    historical_semantics_version: projectionEnvelope.historical_semantics_version,
    projection_hash: projectionEnvelope.projection_hash,
    world_lineage: worldLineage,
    committed_turn_id: committedTurnId,
    committed_revision: revision,
    projection_slot: characterProjection.projection_slot,
    experience_sequence: experienceSequence,
    character_entity_id: runtimeSnapshot.character_entity_id,
    character: characterProjection.character,
    experience: cloneJson(characterProjection.experience),
    boundaries: {
      world_truth_is_not_character_experience: true,
      character_experience_is_not_memory: true,
      full_world_state_exposed: false,
      hidden_causal_chain_exposed: false,
      projector_metadata_exposed_to_character_brain: false,
      durable_mind_mutation: false,
    },
  };
}

export async function resolveWorldSimulationFormalCharacterIdentity(
  character,
  options = {},
) {
  const requestedName = nonEmptyString(character, "character");
  const normalizedRequestedName = normalizeEntityName(requestedName);
  const { registry } = await getStructuredEntityRegistry(
    options.characterIdentityRegistryOptions ?? {},
  );
  // Registry status may reflect incomplete character details (for example an
  // unconfirmed ability). Formal Runtime identity is the stable character
  // entity_id itself, not whether every character field is already settled.
  const matches = array(registry.characters).filter((entity) => {
    if (entity.entity_id === requestedName) return true;
    const names = [entity.canonical_name, ...array(entity.aliases)];
    return names.some((name) => normalizeEntityName(name) === normalizedRequestedName);
  });

  if (matches.length === 1) {
    return {
      entity_id: nonEmptyString(matches[0].entity_id, "character entity_id"),
      canonical_name: nonEmptyString(matches[0].canonical_name, "character canonical_name"),
      identity_source: "structured_canon_entity_registry",
      formal: true,
    };
  }

  if (matches.length > 1) {
    const error = new Error(
      `Formal character identity is ambiguous for ${requestedName}.`,
    );
    error.code = "WORLD_SIMULATION_CHARACTER_IDENTITY_AMBIGUOUS";
    throw error;
  }

  if (options.fixtureRoot) {
    return {
      entity_id: `fixture_character_${hashAgentRunValue({ character: requestedName }).slice(0, 20)}`,
      canonical_name: requestedName,
      identity_source: "test_fixture_ephemeral_identity",
      formal: false,
    };
  }

  const error = new Error(
    `Formal character identity could not be resolved for ${requestedName}.`,
  );
  error.code = "WORLD_SIMULATION_CHARACTER_IDENTITY_NOT_FOUND";
  throw error;
}

async function resolveCharacterRuntimeWorldLineage(
  worldSimulationSessionId,
  options = {},
) {
  const sessionId = nonEmptyString(
    worldSimulationSessionId,
    "world_simulation_session_id",
  );
  if (typeof options.characterRuntimeWorldLineageResolver !== "function") {
    return sessionId;
  }
  return nonEmptyString(
    await options.characterRuntimeWorldLineageResolver({
      world_simulation_session_id: sessionId,
    }),
    "character runtime world lineage",
  );
}

function createCharacterRuntimeInstance({ worldLineage, identity }) {
  const runtimeId = `character_runtime_${hashAgentRunValue({
    world_lineage: worldLineage,
    character_entity_id: identity.entity_id,
  }).slice(0, 20)}`;
  let queueTail = Promise.resolve();
  let activeTurns = 0;
  let pendingTurns = 0;
  let pendingExperienceDeliveries = 0;
  let pendingCurrentMindCycles = 0;
  let pendingCurrentMindDeliveries = 0;
  let lastCommittedExperienceRevision = null;
  let lastCommittedExperienceSequence = 0;
  let lastCommittedCurrentMindRevision = null;
  let committedCurrentMind = currentMindInitialState();
  const consumedExperienceReceiptIds = new Set();
  const consumedCurrentMindTransitionIds = new Set();
  const recentExperienceReceipts = [];
  const recentCurrentMindTransitionIds = [];
  const lifecycle = {
    turns_started: 0,
    turns_completed: 0,
    turns_failed: 0,
    max_concurrent_turns: 0,
  };
  const experienceLifecycle = {
    delivery_attempts: 0,
    committed_experience_effect_count: 0,
    duplicate_delivery_attempts: 0,
    delivery_failures: 0,
  };
  const currentMindLifecycle = {
    speculative_workspace_count: 0,
    delivery_attempts: 0,
    committed_transition_effect_count: 0,
    duplicate_delivery_attempts: 0,
    delivery_failures: 0,
  };

  function enqueueRuntimeOperation(execute, onSettled) {
    const queued = queueTail.then(execute, execute);
    const tracked = queued.finally(onSettled);
    queueTail = tracked.then(() => undefined, () => undefined);
    return tracked;
  }

  async function runTurn(brainInput, characterBrain) {
    if (typeof characterBrain !== "function") {
      const error = new Error("Character Runtime requires a characterBrain backend.");
      error.code = "WORLD_SIMULATION_CHARACTER_BRAIN_REQUIRED";
      throw error;
    }
    const execute = async () => {
      lifecycle.turns_started += 1;
      activeTurns += 1;
      lifecycle.max_concurrent_turns = Math.max(
        lifecycle.max_concurrent_turns,
        activeTurns,
      );
      if (activeTurns !== 1) {
        activeTurns -= 1;
        const error = new Error("Character Runtime turn became reentrant.");
        error.code = "WORLD_SIMULATION_CHARACTER_RUNTIME_REENTRANT";
        throw error;
      }
      try {
        const selection = await characterBrain(cloneJson(brainInput));
        lifecycle.turns_completed += 1;
        return selection;
      } catch (error) {
        lifecycle.turns_failed += 1;
        throw error;
      } finally {
        activeTurns -= 1;
      }
    };
    pendingTurns += 1;
    return enqueueRuntimeOperation(execute, () => {
      pendingTurns -= 1;
    });
  }

  async function prepareSpeculativeCurrentMind(input = {}) {
    pendingCurrentMindCycles += 1;
    return enqueueRuntimeOperation(async () => {
      currentMindLifecycle.speculative_workspace_count += 1;
      return buildWorldSimulationCharacterCurrentMindTransition({
        ...cloneJson(input),
        world_lineage: worldLineage,
        character_entity_id: identity.entity_id,
        canonical_name: identity.canonical_name,
        identity_source: identity.identity_source,
        formal_identity: identity.formal === true,
        prior_current_mind: cloneJson(committedCurrentMind),
        recent_experience_receipts: cloneJson(recentExperienceReceipts),
      });
    }, () => {
      pendingCurrentMindCycles -= 1;
    });
  }

  async function consumeCommittedCurrentMind(input = {}) {
    const characterProjection = verifyCharacterCurrentMindTransitionProjection(
      input.character_projection,
    );
    const committedRevision = Number(input.committed_revision);
    if (!Number.isSafeInteger(committedRevision) || committedRevision < 1) {
      const error = new Error("Committed Character Current Mind transition revision is invalid.");
      error.code = "WORLD_SIMULATION_CHARACTER_CURRENT_MIND_REVISION_INVALID";
      throw error;
    }
    pendingCurrentMindDeliveries += 1;
    return enqueueRuntimeOperation(async () => {
      currentMindLifecycle.delivery_attempts += 1;
      try {
        if (characterProjection.world_lineage !== worldLineage
          || characterProjection.character_entity_id !== identity.entity_id) {
          const error = new Error(
            "Committed Character Current Mind transition identity does not match Runtime identity.",
          );
          error.code = "WORLD_SIMULATION_CHARACTER_CURRENT_MIND_IDENTITY_MISMATCH";
          throw error;
        }
        const transitionId = characterProjection.transition_hash;
        if (consumedCurrentMindTransitionIds.has(transitionId)) {
          currentMindLifecycle.duplicate_delivery_attempts += 1;
          return {
            consumed: false,
            duplicate: true,
            transition_id: transitionId,
            committed_revision: committedRevision,
            current_mind_sequence: characterProjection.current_mind_sequence,
          };
        }
        const sequence = Number(characterProjection.current_mind_sequence);
        const expectedSequence = Number(committedCurrentMind.current_mind_sequence ?? 0) + 1;
        if (!Number.isSafeInteger(sequence) || sequence !== expectedSequence) {
          const error = new Error(
            `Committed Character Current Mind transition is out of order: expected sequence ${expectedSequence}, received ${sequence}.`,
          );
          error.code = "WORLD_SIMULATION_CHARACTER_CURRENT_MIND_OUT_OF_ORDER";
          throw error;
        }
        if (lastCommittedCurrentMindRevision !== null
          && committedRevision <= lastCommittedCurrentMindRevision) {
          const error = new Error(
            `Committed Character Current Mind transition revision is out of order: last ${lastCommittedCurrentMindRevision}, received ${committedRevision}.`,
          );
          error.code = "WORLD_SIMULATION_CHARACTER_CURRENT_MIND_OUT_OF_ORDER";
          throw error;
        }
        const nextState = object(characterProjection.reducer_state_after);
        if (Number(nextState.current_mind_sequence) !== sequence) {
          const error = new Error(
            "Committed Character Current Mind reducer state sequence does not match transition sequence.",
          );
          error.code = "WORLD_SIMULATION_CHARACTER_CURRENT_MIND_STATE_SEQUENCE_MISMATCH";
          throw error;
        }
        committedCurrentMind = cloneJson(nextState);
        lastCommittedCurrentMindRevision = committedRevision;
        consumedCurrentMindTransitionIds.add(transitionId);
        recentCurrentMindTransitionIds.push(transitionId);
        if (recentCurrentMindTransitionIds.length > 16) recentCurrentMindTransitionIds.shift();
        currentMindLifecycle.committed_transition_effect_count += 1;
        return {
          consumed: true,
          duplicate: false,
          transition_id: transitionId,
          committed_revision: committedRevision,
          current_mind_sequence: sequence,
        };
      } catch (error) {
        currentMindLifecycle.delivery_failures += 1;
        throw error;
      }
    }, () => {
      pendingCurrentMindDeliveries -= 1;
    });
  }

  async function consumeCommittedExperience(receipt) {
    const detachedReceipt = cloneJson(receipt);
    pendingExperienceDeliveries += 1;
    return enqueueRuntimeOperation(async () => {
      experienceLifecycle.delivery_attempts += 1;
      try {
        if (detachedReceipt.character_entity_id !== identity.entity_id) {
          const error = new Error("Committed Character Experience receipt character identity does not match Runtime identity.");
          error.code = "WORLD_SIMULATION_CHARACTER_EXPERIENCE_IDENTITY_MISMATCH";
          throw error;
        }
        if (consumedExperienceReceiptIds.has(detachedReceipt.receipt_id)) {
          experienceLifecycle.duplicate_delivery_attempts += 1;
          return {
            consumed: false,
            duplicate: true,
            receipt_id: detachedReceipt.receipt_id,
            committed_revision: detachedReceipt.committed_revision,
            experience_sequence: detachedReceipt.experience_sequence,
          };
        }
        const revision = Number(detachedReceipt.committed_revision);
        if (!Number.isSafeInteger(revision) || revision < 1) {
          const error = new Error("Committed Character Experience receipt revision is invalid.");
          error.code = "WORLD_SIMULATION_CHARACTER_EXPERIENCE_REVISION_INVALID";
          throw error;
        }
        const experienceSequence = Number(detachedReceipt.experience_sequence);
        if (!Number.isSafeInteger(experienceSequence) || experienceSequence < 1) {
          const error = new Error("Committed Character Experience receipt sequence is invalid.");
          error.code = "WORLD_SIMULATION_CHARACTER_EXPERIENCE_SEQUENCE_INVALID";
          throw error;
        }
        const expectedExperienceSequence = lastCommittedExperienceSequence + 1;
        if (experienceSequence !== expectedExperienceSequence) {
          const error = new Error(
            `Committed Character Experience receipt is out of order: expected sequence ${expectedExperienceSequence}, received ${experienceSequence}.`,
          );
          error.code = "WORLD_SIMULATION_CHARACTER_EXPERIENCE_OUT_OF_ORDER";
          throw error;
        }
        if (lastCommittedExperienceRevision !== null
          && revision <= lastCommittedExperienceRevision) {
          const error = new Error(
            `Committed Character Experience receipt revision is out of order: last ${lastCommittedExperienceRevision}, received ${revision}.`,
          );
          error.code = "WORLD_SIMULATION_CHARACTER_EXPERIENCE_OUT_OF_ORDER";
          throw error;
        }
        consumedExperienceReceiptIds.add(detachedReceipt.receipt_id);
        lastCommittedExperienceRevision = revision;
        lastCommittedExperienceSequence = experienceSequence;
        experienceLifecycle.committed_experience_effect_count += 1;
        recentExperienceReceipts.push(detachedReceipt);
        if (recentExperienceReceipts.length > 16) recentExperienceReceipts.shift();
        return {
          consumed: true,
          duplicate: false,
          receipt_id: detachedReceipt.receipt_id,
          committed_revision: revision,
          experience_sequence: experienceSequence,
        };
      } catch (error) {
        experienceLifecycle.delivery_failures += 1;
        throw error;
      }
    }, () => {
      pendingExperienceDeliveries -= 1;
    });
  }

  function snapshot() {
    return {
      runtime_version: worldSimulationCharacterRuntimeVersion,
      runtime_id: runtimeId,
      world_lineage: worldLineage,
      character_entity_id: identity.entity_id,
      canonical_name: identity.canonical_name,
      identity_source: identity.identity_source,
      formal_identity: identity.formal === true,
      lifecycle: cloneJson(lifecycle),
      active_turns: activeTurns,
      pending_turns: pendingTurns,
      pending_runtime_operations:
        pendingTurns
        + pendingExperienceDeliveries
        + pendingCurrentMindCycles
        + pendingCurrentMindDeliveries,
      current_mind: {
        owner: "character_runtime",
        contract_version: worldSimulationCharacterCurrentMindContractVersion,
        attention_reducer_version: worldSimulationCharacterAttentionReducerVersion,
        projection_version: worldSimulationCharacterCurrentMindProjectionVersion,
        ...cloneJson(currentMindLifecycle),
        last_committed_revision: lastCommittedCurrentMindRevision,
        committed_sequence: Number(committedCurrentMind.current_mind_sequence ?? 0),
        pending_speculative_cycles: pendingCurrentMindCycles,
        pending_deliveries: pendingCurrentMindDeliveries,
        character_facing_view: currentMindCharacterView(committedCurrentMind),
        reducer_state: cloneJson(committedCurrentMind),
        recent_transition_ids: cloneJson(recentCurrentMindTransitionIds),
        transition_identity_cache_size: consumedCurrentMindTransitionIds.size,
        historical_transition_persistence: true,
        process_local_state_rebuildable_from_history: true,
        persistent_mind_learning_installed: false,
      },
      committed_experience: {
        ...cloneJson(experienceLifecycle),
        last_committed_revision: lastCommittedExperienceRevision,
        last_experience_sequence: lastCommittedExperienceSequence,
        pending_deliveries: pendingExperienceDeliveries,
        recent_receipts: cloneJson(recentExperienceReceipts),
        receipt_identity_cache_size: consumedExperienceReceiptIds.size,
      },
      durable_mind_persistence: false,
      durable_mind_mutation_count: 0,
    };
  }

  return {
    runTurn,
    prepareSpeculativeCurrentMind,
    consumeCommittedCurrentMind,
    consumeCommittedExperience,
    snapshot,
  };
}

export function createWorldSimulationCharacterRuntimeManager(config = {}) {
  const identityResolver = typeof config.identityResolver === "function"
    ? config.identityResolver
    : resolveWorldSimulationFormalCharacterIdentity;
  const runtimes = new Map();

  function getOrCreateRuntimeByResolvedIdentity({ worldLineage, identity }) {
    const resolvedWorldLineage = nonEmptyString(
      worldLineage,
      "character runtime world lineage",
    );
    const entityId = nonEmptyString(identity?.entity_id, "character entity_id");
    const key = JSON.stringify([resolvedWorldLineage, entityId]);
    let runtime = runtimes.get(key);
    if (!runtime) {
      runtime = createCharacterRuntimeInstance({
        worldLineage: resolvedWorldLineage,
        identity: {
          entity_id: entityId,
          canonical_name: identity?.canonical_name ?? entityId,
          identity_source: identity?.identity_source ?? "resolved_character_runtime_identity",
          formal: identity?.formal === true,
        },
      });
      runtimes.set(key, runtime);
    }
    return runtime;
  }

  async function getRuntime(input = {}, options = {}) {
    const character = nonEmptyString(input.character, "character");
    const worldLineage = await resolveCharacterRuntimeWorldLineage(
      input.world_simulation_session_id,
      options,
    );
    const identity = await identityResolver(character, options);
    return getOrCreateRuntimeByResolvedIdentity({
      worldLineage,
      identity: {
        entity_id: identity?.entity_id,
        canonical_name: identity?.canonical_name ?? character,
        identity_source: identity?.identity_source ?? "custom_character_identity_resolver",
        formal: identity?.formal === true,
      },
    });
  }

  async function runCharacterTurn(input = {}, options = {}) {
    const runtime = await getRuntime(input, options);
    return runtime.runTurn(input.brain_input, input.characterBrain);
  }

  async function prepareSpeculativeCurrentMind(input = {}, options = {}) {
    const runtime = await getRuntime(input, options);
    return runtime.prepareSpeculativeCurrentMind({
      turn_id: input.turn_id,
      character: input.character,
      simulation_time: input.simulation_time ?? null,
      perception: cloneJson(input.perception ?? {}),
      recovered_memories: cloneJson(input.recovered_memories ?? []),
      current_action: cloneJson(input.current_action ?? null),
      compatibility_state: cloneJson(input.compatibility_state ?? {}),
    });
  }

  async function deliverCommittedCurrentMind(input = {}) {
    const historyEntry = object(input.history_entry);
    const projectionEnvelope = verifyCharacterCurrentMindProjectionEnvelope(
      input.projection_envelope
      ?? historyEntry.committed_character_current_mind_projection,
    );
    const committedTurnId = nonEmptyString(
      historyEntry.turn_id,
      "committed current mind history turn_id",
    );
    if (projectionEnvelope.turn_id !== committedTurnId) {
      const error = new Error(
        "Committed Character Current Mind projection turn_id does not match committed history.",
      );
      error.code = "WORLD_SIMULATION_CHARACTER_CURRENT_MIND_TURN_MISMATCH";
      throw error;
    }
    const characterProjection = verifyCharacterCurrentMindTransitionProjection(
      input.character_projection,
    );
    const character = nonEmptyString(
      characterProjection.character,
      "current mind projection character",
    );
    const runtime = getOrCreateRuntimeByResolvedIdentity({
      worldLineage: nonEmptyString(
        characterProjection.world_lineage,
        "historical committed current mind world lineage",
      ),
      identity: {
        entity_id: nonEmptyString(
          characterProjection.character_entity_id,
          "historical committed current mind character entity_id",
        ),
        canonical_name: characterProjection.canonical_name ?? character,
        identity_source:
          characterProjection.identity_source
          ?? "historical_committed_character_current_mind_projection",
        formal: characterProjection.formal_identity === true,
      },
    });
    const result = await runtime.consumeCommittedCurrentMind({
      character_projection: characterProjection,
      committed_revision: historyEntry.revision_to,
    });
    return {
      ...result,
      character,
      character_entity_id: characterProjection.character_entity_id,
    };
  }

  async function deliverCommittedCurrentMindProjection(input = {}, options = {}) {
    const historyEntry = object(input.history_entry);
    const projectionEnvelope = verifyCharacterCurrentMindProjectionEnvelope(
      historyEntry.committed_character_current_mind_projection,
    );
    const characterProjections = array(projectionEnvelope.character_projections);
    const settledDeliveries = await Promise.allSettled(
      characterProjections.map((characterProjection) => (
        deliverCommittedCurrentMind({
          world_simulation_session_id: input.world_simulation_session_id,
          history_entry: historyEntry,
          projection_envelope: projectionEnvelope,
          character_projection: characterProjection,
        }, options)
      )),
    );
    const deliveries = settledDeliveries
      .filter((item) => item.status === "fulfilled")
      .map((item) => item.value);
    const failures = settledDeliveries
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.status === "rejected")
      .map(({ item, index }) => ({
        projection_slot: characterProjections[index]?.projection_slot ?? index,
        character: characterProjections[index]?.character ?? null,
        character_entity_id: characterProjections[index]?.character_entity_id ?? null,
        error_code:
          item.reason?.code
          ?? "WORLD_SIMULATION_CHARACTER_CURRENT_MIND_DELIVERY_FAILED",
        error_message: item.reason?.message ?? String(item.reason),
      }));
    return {
      projection_version: projectionEnvelope.projection_version,
      current_mind_contract_version: projectionEnvelope.current_mind_contract_version,
      attention_reducer_version: projectionEnvelope.attention_reducer_version,
      projection_hash: projectionEnvelope.projection_hash,
      delivery_count: characterProjections.length,
      consumed_count: deliveries.filter((item) => item.consumed === true).length,
      duplicate_count: deliveries.filter((item) => item.duplicate === true).length,
      failed_count: failures.length,
      delivery_failed: failures.length > 0,
      replay_required: failures.length > 0,
      deliveries,
      failures,
    };
  }

  async function deliverCommittedExperience(input = {}, options = {}) {
    const historyEntry = object(input.history_entry);
    const projectionEnvelope = verifyCharacterExperienceProjectionEnvelope(
      input.projection_envelope
      ?? historyEntry.committed_character_experience_projection,
    );
    const characterProjection = object(input.character_projection);
    const character = nonEmptyString(characterProjection.character, "experience projection character");
    const runtime = getOrCreateRuntimeByResolvedIdentity({
      worldLineage: nonEmptyString(
        characterProjection.world_lineage,
        "historical committed character experience world lineage",
      ),
      identity: {
        entity_id: nonEmptyString(
          characterProjection.character_entity_id,
          "historical committed character experience character entity_id",
        ),
        canonical_name: characterProjection.canonical_name ?? character,
        identity_source:
          characterProjection.identity_source
          ?? "historical_committed_character_experience_projection",
        formal: characterProjection.formal_identity === true,
      },
    });
    const runtimeSnapshot = runtime.snapshot();
    const receipt = buildCommittedCharacterExperienceReceipt({
      worldLineage: runtimeSnapshot.world_lineage,
      runtimeSnapshot,
      historyEntry,
      projectionEnvelope,
      characterProjection,
    });
    const result = await runtime.consumeCommittedExperience(receipt);
    return {
      ...result,
      character,
      character_entity_id: runtimeSnapshot.character_entity_id,
      receipt: cloneJson(receipt),
    };
  }

  async function deliverCommittedExperienceProjection(input = {}, options = {}) {
    const historyEntry = object(input.history_entry);
    const projectionEnvelope = verifyCharacterExperienceProjectionEnvelope(
      historyEntry.committed_character_experience_projection,
    );
    const characterProjections = array(projectionEnvelope.character_projections);
    const settledDeliveries = await Promise.allSettled(
      characterProjections.map((characterProjection) => (
        deliverCommittedExperience({
          world_simulation_session_id: input.world_simulation_session_id,
          history_entry: historyEntry,
          projection_envelope: projectionEnvelope,
          character_projection: characterProjection,
        }, options)
      )),
    );
    const deliveries = settledDeliveries
      .filter((item) => item.status === "fulfilled")
      .map((item) => item.value);
    const failures = settledDeliveries
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.status === "rejected")
      .map(({ item, index }) => ({
        projection_slot: characterProjections[index]?.projection_slot ?? index,
        character: characterProjections[index]?.character ?? null,
        character_entity_id: characterProjections[index]?.character_entity_id ?? null,
        error_code:
          item.reason?.code
          ?? "WORLD_SIMULATION_CHARACTER_EXPERIENCE_DELIVERY_FAILED",
        error_message: item.reason?.message ?? String(item.reason),
      }));
    return {
      projection_version: projectionEnvelope.projection_version,
      experience_contract_version: projectionEnvelope.experience_contract_version,
      projection_hash: projectionEnvelope.projection_hash,
      delivery_count: characterProjections.length,
      consumed_count: deliveries.filter((item) => item.consumed === true).length,
      duplicate_count: deliveries.filter((item) => item.duplicate === true).length,
      failed_count: failures.length,
      delivery_failed: failures.length > 0,
      replay_required: failures.length > 0,
      deliveries,
      failures,
    };
  }

  async function inspectRuntime(input = {}, options = {}) {
    return (await getRuntime(input, options)).snapshot();
  }

  async function releaseWorldLineage(worldSimulationSessionId, options = {}) {
    const worldLineage = await resolveCharacterRuntimeWorldLineage(
      worldSimulationSessionId,
      options,
    );
    const matching = [...runtimes.entries()].filter(([, runtime]) => (
      runtime.snapshot().world_lineage === worldLineage
    ));
    if (matching.some(([, runtime]) => runtime.snapshot().pending_runtime_operations > 0)) {
      const error = new Error(
        `Character Runtime world lineage ${worldLineage} is busy and cannot be released.`,
      );
      error.code = "WORLD_SIMULATION_CHARACTER_RUNTIME_LINEAGE_BUSY";
      throw error;
    }
    for (const [key] of matching) runtimes.delete(key);
    return matching.length;
  }

  return {
    runtime_version: worldSimulationCharacterRuntimeVersion,
    current_mind_contract_version: worldSimulationCharacterCurrentMindContractVersion,
    attention_reducer_version: worldSimulationCharacterAttentionReducerVersion,
    current_mind_projection_version: worldSimulationCharacterCurrentMindProjectionVersion,
    experience_contract_version: worldSimulationCharacterExperienceContractVersion,
    experience_projection_version: worldSimulationCharacterExperienceProjectionVersion,
    getRuntime,
    runCharacterTurn,
    prepareSpeculativeCurrentMind,
    deliverCommittedCurrentMind,
    deliverCommittedCurrentMindProjection,
    deliverCommittedExperience,
    deliverCommittedExperienceProjection,
    inspectRuntime,
    releaseWorldLineage,
    runtimeCount: () => runtimes.size,
  };
}

const defaultWorldSimulationCharacterRuntimeManager =
  createWorldSimulationCharacterRuntimeManager();

export async function replayWorldSimulationCommittedCharacterExperiences(
  worldSimulationSessionId,
  options = {},
) {
  const sessionId = nonEmptyString(
    worldSimulationSessionId,
    "world_simulation_session_id",
  );
  await assertWorldSimulationSession(sessionId, options);
  const history = await getWorldSimulationHistory(sessionId, options);
  const characterRuntimeManager = options.characterRuntimeManager
    ?? defaultWorldSimulationCharacterRuntimeManager;
  if (typeof characterRuntimeManager?.deliverCommittedExperienceProjection !== "function"
    || typeof characterRuntimeManager?.deliverCommittedCurrentMindProjection !== "function") {
    throw new Error(
      "characterRuntimeManager must provide committed Experience and Current Mind projection delivery.",
    );
  }
  const committedTurns = array(history.turns)
    .filter((turn) => (
      isObject(turn?.committed_character_experience_projection)
      || isObject(turn?.committed_character_current_mind_projection)
    ))
    .sort((left, right) => Number(left.revision_to) - Number(right.revision_to));
  const replayed = [];
  for (const historyEntry of committedTurns) {
    let currentMindDelivery = null;
    if (isObject(historyEntry.committed_character_current_mind_projection)) {
      currentMindDelivery = await characterRuntimeManager.deliverCommittedCurrentMindProjection(
        {
          world_simulation_session_id: sessionId,
          history_entry: historyEntry,
        },
        options,
      );
    }
    let experienceDelivery = {
      delivery_count: 0,
      consumed_count: 0,
      duplicate_count: 0,
      failed_count: 0,
      delivery_failed: false,
      replay_required: false,
      deliveries: [],
      failures: [],
    };
    if (
      currentMindDelivery?.replay_required === true
      && isObject(historyEntry.committed_character_experience_projection)
    ) {
      const experienceProjection = verifyCharacterExperienceProjectionEnvelope(
        historyEntry.committed_character_experience_projection,
      );
      experienceDelivery = {
        projection_version: experienceProjection.projection_version,
        experience_contract_version: experienceProjection.experience_contract_version,
        projection_hash: experienceProjection.projection_hash,
        delivery_count: experienceProjection.character_projections.length,
        consumed_count: 0,
        duplicate_count: 0,
        failed_count: 0,
        delivery_failed: false,
        delivery_deferred: true,
        deferred_reason: "current_mind_replay_still_required",
        replay_required: true,
        deliveries: [],
        failures: [],
      };
    } else if (isObject(historyEntry.committed_character_experience_projection)) {
      experienceDelivery = await characterRuntimeManager.deliverCommittedExperienceProjection(
        {
          world_simulation_session_id: sessionId,
          history_entry: historyEntry,
        },
        options,
      );
    }
    replayed.push({
      ...experienceDelivery,
      current_mind_delivery: currentMindDelivery,
    });
  }
  const failedCount = replayed.reduce((sum, item) => sum + (item.failed_count ?? 0), 0);
  const currentMindFailedCount = replayed.reduce(
    (sum, item) => sum + (item.current_mind_delivery?.failed_count ?? 0),
    0,
  );
  const experienceCommittedTurnCount = committedTurns.filter(
    (turn) => isObject(turn?.committed_character_experience_projection),
  ).length;
  const currentMindCommittedTurnCount = committedTurns.filter(
    (turn) => isObject(turn?.committed_character_current_mind_projection),
  ).length;
  return {
    ok: failedCount === 0 && currentMindFailedCount === 0,
    world_simulation_session_id: sessionId,
    replay_source: "immutable_committed_world_history",
    current_perception_engine_reanalysis_used: false,
    current_attention_algorithm_reanalysis_used: false,
    phase63c_memory_retrieval_reexecution_used: false,
    character_brain_reexecution_used: false,
    historical_projection_semantics_preserved: true,
    committed_turns_with_projection: experienceCommittedTurnCount,
    committed_turns_with_current_mind_projection: currentMindCommittedTurnCount,
    delivery_count: replayed.reduce((sum, item) => sum + item.delivery_count, 0),
    consumed_count: replayed.reduce((sum, item) => sum + item.consumed_count, 0),
    duplicate_count: replayed.reduce((sum, item) => sum + item.duplicate_count, 0),
    failed_count: failedCount,
    current_mind_delivery_count: replayed.reduce(
      (sum, item) => sum + (item.current_mind_delivery?.delivery_count ?? 0),
      0,
    ),
    current_mind_consumed_count: replayed.reduce(
      (sum, item) => sum + (item.current_mind_delivery?.consumed_count ?? 0),
      0,
    ),
    current_mind_failed_count: currentMindFailedCount,
    replay_required: failedCount > 0 || currentMindFailedCount > 0,
    replays: replayed,
  };
}

function characterMapValue(map, character) {
  if (!isObject(map)) return undefined;
  if (Object.hasOwn(map, character)) return map[character];
  const normalized = character.toLocaleLowerCase("zh-Hant-TW");
  for (const [key, value] of Object.entries(map)) {
    if (String(key).trim().toLocaleLowerCase("zh-Hant-TW") === normalized) {
      return value;
    }
  }
  return undefined;
}

function currentEvent(worldState, requestedEventId = null) {
  const queue = array(worldState.event_queue);
  if (!queue.length) {
    const error = new Error("World simulation event_queue is empty.");
    error.code = "WORLD_SIMULATION_EVENT_QUEUE_EMPTY";
    throw error;
  }
  const event = object(queue[0]);
  const eventId = nonEmptyString(event.event_id ?? event.id, "event_queue[0].event_id");
  if (requestedEventId !== null && requestedEventId !== undefined) {
    const requested = nonEmptyString(requestedEventId, "event_id");
    if (requested !== eventId) {
      const error = new Error(
        `Event-driven simulation must resolve the queue head first: expected ${eventId}, received ${requested}.`,
      );
      error.code = "WORLD_SIMULATION_EVENT_ORDER_VIOLATION";
      throw error;
    }
  }
  return { ...cloneJson(event), event_id: eventId };
}

function currentScene(worldState, event) {
  const sceneId = event.scene_id ?? event.location_id ?? null;
  const scenes = object(worldState.scenes);
  if (sceneId && isObject(scenes[sceneId])) return cloneJson(scenes[sceneId]);
  if (isObject(worldState.scene_state)) return cloneJson(worldState.scene_state);
  if (isObject(worldState.current_scene)) return cloneJson(worldState.current_scene);
  throw new Error("World simulation state has no scene for the current event.");
}

function participantsForEvent(worldState, event) {
  const requested = array(event.participants ?? event.character_names)
    .map((item) => typeof item === "string" ? item.trim() : "")
    .filter(Boolean);
  const active = requested.length
    ? requested
    : array(worldState.active_characters)
      .map((item) => typeof item === "string" ? item.trim() : "")
      .filter(Boolean);
  if (!active.length) {
    throw new Error("Current world event has no named-character participants.");
  }
  return [...new Set(active)];
}

function runOptions(options, sessionId, source) {
  return {
    ...(options.fixtureRoot ? { fixtureRoot: options.fixtureRoot } : {}),
    run_id: sessionId,
    source,
  };
}

function boundedMemoryProjectionMaxItems(
  value,
) {
  if (
    value === null
    || value === undefined
    || value === ""
  ) {
    return null;
  }

  const number =
    Number(value);

  if (
    !Number.isSafeInteger(number)
    || number < 0
  ) {
    return null;
  }

  return Math.min(
    32,
    number,
  );
}

function memoryProjectionPolicyFor(
  event,
  character,
  accessibilityResult,
) {
  const eventPolicy =
    object(
      event?.memory_projection_policy,
    );

  const byCharacter =
    object(
      eventPolicy.by_character,
    );

  const characterPolicy =
    object(
      characterMapValue(
        byCharacter,
        character,
      ),
    );

  const hasCharacterLimit =
    Object.hasOwn(
      characterPolicy,
      "max_items",
    );

  const hasEventLimit =
    Object.hasOwn(
      eventPolicy,
      "max_items",
    );

  if (
    hasCharacterLimit
    || hasEventLimit
  ) {
    const raw =
      hasCharacterLimit
        ? characterPolicy.max_items
        : eventPolicy.max_items;

    const maxItems =
      boundedMemoryProjectionMaxItems(
        raw,
      );

    if (maxItems === null) {
      const error = new Error(
        "memory_projection_policy.max_items must be an integer from 0 through 32.",
      );

      error.code =
        "WORLD_SIMULATION_MEMORY_PROJECTION_MAX_ITEMS_INVALID";

      throw error;
    }

    return {
      max_items:
        maxItems,

      origin:
        hasCharacterLimit
          ? "event_character_projection_policy"
          : "event_projection_policy",
    };
  }

  const legacyMax =
    boundedMemoryProjectionMaxItems(
      accessibilityResult
        ?.legacy_projection_max_items,
    );

  if (legacyMax !== null) {
    return {
      max_items:
        legacyMax,

      origin:
        "legacy_phase63b_profile_compatibility",
    };
  }

  return {
    max_items:
      null,

    origin:
      "default_memory_context_projection_policy",
  };
}

async function capability(sessionId, name, input, options, traceIds) {
  const result = await runWorldSimulationNativeCapability(
    name,
    input,
    runOptions(options, sessionId, `world_simulation_loop:${name}`),
  );
  traceIds.push(result.trace.trace_id);
  return result.output;
}

async function resolveMemoryRetrievalResolution(
  context,
  options,
) {
  const resolver =
    typeof options.memoryRetrievalResolver === "function"
      ? options.memoryRetrievalResolver
      : null;

  if (!resolver) {
    return {
      resolution: {
        process_occurred: false,
      },
      audit: {
        resolver_used: false,
        missing_resolver_means_no_process: true,
        candidate_presence_implies_process: false,
        world_state_exposed_to_resolver: false,
        full_world_event_exposed_to_resolver: false,
        candidate_content_engine_side_only: true,
      },
    };
  }

  const input = {
    character:
      context.character,
    query:
      cloneJson(context.query),
    candidate_memory_records:
      cloneJson(context.candidate_memory_records),
    candidate_evaluations:
      cloneJson(context.candidate_evaluations),
    perception:
      cloneJson(context.perception),
    character_state:
      cloneJson(context.character_state),
  };

  const inputSnapshot =
    cloneJson(input);

  const raw =
    await resolver(
      cloneJson(inputSnapshot),
    );

  if (!isObject(raw)) {
    const error = new Error(
      "memoryRetrievalResolver must return one explicit retrieval-process resolution object.",
    );
    error.code =
      "WORLD_SIMULATION_MEMORY_RETRIEVAL_RESOLVER_INVALID_OUTPUT";
    throw error;
  }

  return {
    resolution:
      cloneJson(raw),
    audit: {
      resolver_used: true,
      input_context_hash:
        hashAgentRunValue(inputSnapshot),
      world_state_exposed_to_resolver: false,
      full_world_event_exposed_to_resolver: false,
      candidate_content_engine_side_only: true,
      resolver_may_author_recovered_content: false,
      resolver_selects_source_grounding_only: true,
    },
  };
}

function candidateSelection(candidateOutput, selection, character) {
  const candidates = array(candidateOutput.candidate_action_intents);
  if (selection === null || selection === undefined || selection === "reject_all") {
    return {
      character,
      selection: "reject_all",
      action_id: null,
      intent: null,
      candidate: null,
    };
  }
  const actionId = typeof selection === "string"
    ? selection.trim()
    : String(selection?.action_id ?? selection?.id ?? "").trim();
  if (!actionId) {
    throw new Error(`Character brain selection for ${character} must provide action_id or reject_all.`);
  }
  const candidate = candidates.find((item) => String(item.action_id) === actionId);
  if (!candidate) {
    const error = new Error(
      `Character brain selected unavailable action ${actionId} for ${character}.`,
    );
    error.code = "WORLD_SIMULATION_ACTION_NOT_AVAILABLE";
    throw error;
  }
  return {
    character,
    selection: "candidate_action_intent",
    action_id: actionId,
    intent: candidate.intent ?? null,
    candidate: cloneJson(candidate),
  };
}

function assertCausalResolution(value) {
  if (!isObject(value)) {
    throw new Error("causalAdjudicator must return an object.");
  }
  if (!isObject(value.next_world_state)) {
    throw new Error("causalAdjudicator must return next_world_state.");
  }
  return value;
}

function applySubjectiveMemoryPreview(worldState, formationResult) {
  const preview = cloneJson(worldState);
  preview.memories = object(preview.memories);
  for (const update of array(formationResult?.character_updates)) {
    const character = String(update?.character ?? "").trim();
    if (!character || !Array.isArray(update?.memory_records) || update.memory_records.length === 0) continue;
    const current = array(characterMapValue(preview.memories, character)).map(cloneJson);
    preview.memories[character] = [...current, ...update.memory_records.map(cloneJson)];
  }
  return preview;
}

export function buildWorldSimulationLoopContract() {
  return {
    version: worldSimulationLoopVersion,
    scheduling: "event_driven",
    world_state_owner: "programmatic_world_simulator",
    character_choice_owner: "chatgpt_character_brain",
    character_runtime: {
      version: worldSimulationCharacterRuntimeVersion,
      identity: "world_lineage_plus_formal_character_entity_id",
      current_world_lineage_carrier: "world_simulation_session_id",
      current_world_lineage_carrier_is_permanent_world_philosophy: false,
      same_runtime_reentrant: false,
      same_runtime_turns_serialized: true,
      different_runtimes_share_turn_lock: false,
      storage_scope: "process_local_ephemeral_memory",
      lifecycle_release_requires_idle: true,
      delegates_existing_character_brain_backend: true,
      durable_mind_persistence: false,
      durable_mind_mutation_before_world_commit: false,
      committed_experience_delivery: "at_least_once_with_idempotent_runtime_consumption",
      committed_experience_ordering_scope: "world_lineage_plus_character_entity_id",
      committed_experience_ordering_mechanism:
        "contiguous_per_character_experience_sequence_plus_committed_revision",
      committed_experience_sequence_source: "immutable_committed_world_history",
      committed_experience_global_delivery_lock: false,
      durable_experience_cursor_installed: false,
      current_mind_owner: "character_runtime",
      current_mind_state_scope: "process_local_rebuildable_from_committed_history",
      current_mind_historical_transition_persistence: true,
      current_mind_commit_boundary: "successful_world_commit_only",
      post_commit_cognitive_delivery_order:
        "current_mind_transition_before_experience_receipt",
      experience_delivery_deferred_when_current_mind_replay_required: true,
      current_mind_global_attention_lock: false,
      persistent_mind_learning_installed: false,
    },
    character_current_mind: {
      current_mind_contract_version: worldSimulationCharacterCurrentMindContractVersion,
      attention_reducer_version: worldSimulationCharacterAttentionReducerVersion,
      projection_version: worldSimulationCharacterCurrentMindProjectionVersion,
      owner: "character_runtime",
      source_pipeline: [
        "bounded_perception",
        "actual_phase63c_recovered_memories",
        "prior_committed_current_mind",
        "current_action_intention",
        "legacy_compatibility_seed",
        "prior_committed_character_experience",
      ],
      legacy_attention_seed_bootstrap_only: true,
      legacy_expectation_seed_bootstrap_only: true,
      speculative_before_world_commit: true,
      committed_only_after_successful_world_commit: true,
      blocked_consistency_discards_speculation: true,
      stale_commit_discards_speculation: true,
      commit_failure_discards_speculation: true,
      historical_transition_projection_persisted: true,
      historical_replay_runs_current_attention_algorithm: false,
      historical_replay_reasks_character_brain: false,
      historical_replay_reruns_phase63c_retrieval: false,
      attention_processes: [
        "perceptual_salience",
        "goal_intention_relevance",
        "expectation_violation",
        "immediate_constraint_urgency",
        "focus_continuity",
      ],
      common_deterministic_priority_resolver: true,
      asynchronous_codelet_race_used: false,
      random_tie_break_used: false,
      focus_inertia_hysteresis_installed: true,
      interruption_uses_relative_priority: true,
      interrupted_focus_erased_immediately: false,
      suspended_and_fading_context_installed: true,
      decay_basis: "simulation_time_plus_committed_cognitive_sequence",
      wall_clock_decay_used: false,
      fixed_four_item_working_memory_assumed: false,
      bounded_workspace_budget_is_engineering_bound: true,
      attention_internal_state_exposed_to_character_brain: false,
      character_facing_attention_view_exposed_to_character_brain: true,
      encoding_evidence_view_available_to_programmatic_policy: true,
      focus_directly_equals_encode: false,
      non_focus_encoding_evidence_allowed: true,
      gpt_may_author_historical_attention_projection: false,
      gpt_hidden_reasoning_persisted: false,
      experience_receipt_same_turn_retroactive_attention_allowed: false,
      persistent_mind_database_installed: false,
    },
    committed_character_experience: {
      experience_contract_version: worldSimulationCharacterExperienceContractVersion,
      projection_version: worldSimulationCharacterExperienceProjectionVersion,
      owner: "server_owned_programmatic_boundary",
      world_truth_is_character_experience: false,
      character_experience_is_memory: false,
      established_only_after_successful_world_commit: true,
      blocked_or_failed_commit_delivery_count: 0,
      history_storage: "hybrid_event_projection",
      objective_source_of_truth: "committed_world_history",
      full_next_world_state_stored_in_projection: false,
      deterministic_receipt_identity: true,
      replay_uses_historical_projection_semantics: true,
      replay_reinterprets_history_with_current_perception_engine: false,
      participant_and_observer_channels_distinct: true,
      participant_intent_is_successful_outcome: false,
      objective_action_result_auto_exposed: false,
      explicit_bounded_actor_experience_evidence_required_for_post_outcome_experience: true,
      hidden_world_truth_allowed: false,
      projector_metadata_exposed_to_character_brain: false,
      gpt_may_author_receipt: false,
      gpt_may_modify_projection_version: false,
      receipt_auto_consolidates_memory: false,
      phase63_subjective_memory_contract_replaced: false,
    },
    causal_outcome_owner: "programmatic_causal_adjudicator",
    commit_policy: "consistency_critic_must_report_zero_hard_conflicts",
    character_brain_receives_world_truth: false,
    character_brain_receives_engine_simulation_time: false,
    character_brain_receives_engine_scene_id: false,
    character_brain_receives_capability_runtime_metadata: false,
    character_brain_receives_raw_world_event: false,
    character_brain_receives_session_or_turn_identity: false,
    character_facing_capability_envelopes_enforced: true,
    engine_integrity_capability_envelopes_enforced: true,
    scene_neural_advisory_is_causal_input: false,
    consistency_neural_advisory_is_commit_gate: false,
    agency_neural_advisory_is_security_policy: false,
    neural_capabilities_may_mutate_world_state: false,
    causal_adjudicator_required: true,
    visibility_and_occlusion: buildWorldSimulationVisibilityQueryContract(),
    directional_height_visibility: buildWorldSimulationDirectionalHeightVisibilityContract(),
    illumination_visibility: buildWorldSimulationIlluminationVisibilityContract(),
    audibility_and_sound_propagation: buildWorldSimulationAudibilityQueryContract(),
    subjective_memory_formation: buildWorldSimulationSubjectiveMemoryFormationContract(),
    subjective_memory_accessibility: buildWorldSimulationMemoryAccessibilityContract(),
    retrieval_practice_activation_projection:
      buildWorldSimulationRetrievalPracticeActivationProjectionContract(),
    base_level_activation_projection:
      buildWorldSimulationBaseLevelActivationProjectionContract(),
    query_relative_cue_diagnostic_evidence_projection:
      buildWorldSimulationCueDiagnosticEvidenceProjectionContract(),
    subjective_memory_retrieval_process: buildWorldSimulationMemoryRetrievalProcessV3Contract(),
    subjective_memory_retrieval_process_step3_compatibility:
      buildWorldSimulationMemoryRetrievalProcessContract(),
    subjective_memory_retrieval_persistence:
      buildWorldSimulationMemoryRetrievalPersistenceContract(),

    memory_context_projection: {
      owner:
        "engine_memory_context_projector",

      accessibility_candidate_set_is_authoritative_input:
        true,

      projection_budget_is_separate_from_memory_accessibility:
        true,

      projection_budget_is_cognitive_capacity:
        false,

      projection_budget_zero_allowed:
        true,

      legacy_phase63b_max_items_fallback_supported:
        true,

      actual_retrieval_success_asserted:
        false,

      output_is_character_brain_memory_context_projection:
        true,

      engine_retrieval_context_exposed_to_character_brain:
        false,

      engine_projection_policy_exposed_to_character_brain:
        false,

      projection_appends_retrieval_history:
        false,

      projection_updates_recall_count:
        false,

      projection_updates_last_recalled_at:
        false,

      same_cycle_projection_feeds_memory_accessibility:
        false,

      actual_retrieval_event_owner:
        "Phase63C",

      phase63c_schema_contract_installed:
        true,

      phase63c_runtime_version:
        worldSimulationMemoryRetrievalProcessV3Version,

      phase63c_step3_compatibility_runtime_version:
        worldSimulationMemoryRetrievalProcessVersion,

      candidate_content_barrier_enforced:
        true,

      candidate_content_barrier_owner:
        "Phase63C Step2",

      native_character_brain_memory_channel:
        "recovered_memories",

      native_recovered_memories_default_empty_until_retrieval_kernel:
        false,

      missing_retrieval_resolver_means_no_process:
        true,

      retrieval_experience_channel:
        "retrieval_experience",

      legacy_projector_api_preserved:
        true,

      legacy_projector_output_engine_only_in_native_loop:
        true,

      legacy_projected_memory_content_forwarded_to_character_brain:
        false,

      native_retrieval_process_execution_installed:
        true,

      retrieval_event_persistence_installed:
        true,

      retrieval_event_persistence_version:
        worldSimulationMemoryRetrievalPersistenceVersion,

      same_cycle_retrieval_history_feedback_allowed:
        false,
    },

    subjective_memory_retrieval_stage_resolution_hook: {
      owner:
        "programmatic_memory_retrieval_stage_resolver",

      optional:
        true,

      option_name:
        "memoryRetrievalStageResolver",

      staged_lifecycle:
        true,

      stages: [
        "initiation",
        "recovery",
        "continuation",
      ],

      conditional_stages: [
        "cue_construction",
      ],

      cue_construction_request_field:
        "cue_construction_requested",

      cue_construction_actual_materialized_sources_only:
        true,

      cue_construction_character_state_exposed:
        false,

      cue_construction_full_memory_records_exposed:
        false,

      cue_construction_unrecovered_memory_content_exposed:
        false,

      cue_construction_world_state_exposed:
        false,

      cue_construction_future_event_queue_exposed:
        false,

      episode_local_evidence_reprojection_is_engine_side:
        true,

      episode_local_evidence_reprojection_r4b1_process_wide_baseline_reused:
        true,

      r4d_used_during_episode_local_reprojection:
        false,

      global_termination_decision_semantics_engine_side:
        true,

      global_termination_new_resolver_stage_added:
        false,

      global_termination_stopping_rule_modeled:
        false,

      global_termination_r4d_consumed_online:
        false,

      technical_step_budget_option:
        "memoryRetrievalTechnicalStepBudget",

      technical_step_budget_is_cognitive_stopping_rule:
        false,

      technical_step_budget_exhaustion_fails_closed:
        true,

      receives_world_state:
        false,

      receives_full_world_event:
        false,

      future_frontier_content_visible_to_earlier_stage:
        false,

      non_frontier_candidate_diagnostics_visible:
        false,

      resolver_may_author_recovered_memory_content:
        false,

      resolver_may_author_reinstated_cue_content:
        false,

      legacy_single_step_hook_preserved:
        true,
    },

    subjective_memory_retrieval_resolution_hook: {
      owner:
        "programmatic_memory_retrieval_resolver",

      optional: true,

      missing_hook_means_no_retrieval_process:
        true,

      receives_world_state:
        false,

      receives_full_world_event:
        false,

      receives_frozen_candidate_content_engine_side:
        true,

      receives_phase63b_candidate_evaluations:
        true,

      receives_bounded_perception:
        true,

      receives_character_own_state:
        true,

      may_author_recovered_memory_content:
        false,

      selects_source_grounding_only:
        true,
    },

    subjective_memory_encoding_decision_hook: {
      owner:
        "programmatic_memory_encoding_decider",

      optional: true,

      receives_world_state:
        false,

      receives_full_world_event:
        false,

      receives_bounded_perception:
        true,

      receives_bounded_cognition:
        true,

      receives_runtime_attention_encoding_evidence:
        true,

      focus_directly_controls_encoding:
        false,

      non_focus_observation_may_supply_encoding_evidence:
        true,

      character_brain_direct_encoding_control_allowed:
        false,

      missing_hook_preserves_legacy_encoding:
        true,
    },

    subjective_memory_episode_binding_hook: {
      owner:
        "programmatic_subjective_episode_binder",

      optional:
        true,

      receives_world_state:
        false,

      receives_full_world_event:
        false,

      receives_bounded_perception:
        true,

      receives_bounded_cognition:
        true,

      receives_encoding_decisions:
        true,

      automatic_event_segmentation:
        false,

      world_event_id_auto_used_as_episode_id:
        false,

      character_brain_direct_episode_binding_allowed:
        false,
    },
    character_perception_visuals_use_programmatic_visibility: true,
    character_perception_visuals_use_directional_height_visibility: true,
    character_perception_visuals_use_illumination_visibility: true,
    character_perception_audio_uses_programmatic_audibility: true,
    built_in_causal_rule_engine: buildWorldSimulationCausalRuleContract(),
    custom_causal_adjudicator_override_supported: true,
    stale_state_commit_rejected: true,
    replay_chain_uses_state_hashes: true,
  };
}

export async function prepareWorldSimulationTurn(input = {}, options = {}) {
  const sessionId = nonEmptyString(
    input.world_simulation_session_id,
    "world_simulation_session_id",
  );
  await assertWorldSimulationSession(sessionId, options);
  const snapshot = await getWorldSimulationState(sessionId, options);
  const worldState = snapshot.state;
  const event = currentEvent(worldState, input.event_id ?? null);
  const sceneState = currentScene(worldState, event);
  const participants = participantsForEvent(worldState, event);
  const traceIds = [];
  const visibilityQueries = [];
  const directionalHeightVisibilityQueries = [];
  const illuminationVisibilityQueries = [];
  const audibilityQueries = [];
  const memoryAccessibilityQueries = [];
  const memoryRetrievalQueries = [];
  const memoryRetrievalProcesses = [];
  const characterRuntimeManager = options.characterRuntimeManager
    ?? defaultWorldSimulationCharacterRuntimeManager;
  if (typeof characterRuntimeManager?.prepareSpeculativeCurrentMind !== "function") {
    throw new Error(
      "characterRuntimeManager must provide prepareSpeculativeCurrentMind().",
    );
  }

  const turnId = `world_turn_${hashAgentRunValue({
    world_simulation_session_id: sessionId,
    revision: snapshot.revision,
    state_hash: snapshot.state_hash,
    event_id: event.event_id,
  }).slice(0, 20)}`;

  const sceneAnalysis = await capability(
    sessionId,
    "world_scene_causal_analyzer",
    {
      scene_state: sceneState,
      simulation_time: worldState.simulation_time ?? event.simulation_time ?? null,
      simultaneous_actions: [],
    },
    options,
    traceIds,
  );

  const decisionPackets = [];
  const attentionEncodingEvidence = [];
  const currentMindTransitionProjections = [];
  for (const character of participants) {
    const characterState = object(characterMapValue(worldState.characters, character));
    const memories = array(characterMapValue(worldState.memories, character));
    const retrievalPracticeActivationProjection =
      projectWorldSimulationRetrievalPracticeActivation({
        world_state:
          worldState,
        character,
        current_turn_id:
          turnId,
        as_of:
          worldState.simulation_time
          ?? event.simulation_time
          ?? null,
        memory_records:
          memories,
      });
    const baseLevelActivationProjection =
      projectWorldSimulationBaseLevelActivation({
        memory_records:
          memories,
        retrieval_practice_projection:
          retrievalPracticeActivationProjection,
      });
    const retrievalMemoryRecords =
      baseLevelActivationProjection
        .projected_memory_records;
    const availableActions = array(
      characterMapValue(worldState.available_actions, character),
    );
    const visibilityQuery = queryWorldSimulationObserverVisibility({
      world_state: worldState,
      scene_state: sceneState,
      scene_id: sceneState.scene_id ?? event.scene_id ?? event.location_id ?? null,
      observer: character,
    });
    visibilityQueries.push({
      observer: character,
      version: visibilityQuery.visibility_query_version,
      result: cloneJson(visibilityQuery.result),
      audit: cloneJson(visibilityQuery.audit),
    });
    const directionalHeightVisibilityQuery = queryWorldSimulationObserverDirectionalHeightVisibility({
      world_state: worldState,
      scene_state: sceneState,
      scene_id: sceneState.scene_id ?? event.scene_id ?? event.location_id ?? null,
      observer: character,
    });
    directionalHeightVisibilityQueries.push({
      observer: character,
      version: directionalHeightVisibilityQuery.directional_height_visibility_version,
      result: cloneJson(directionalHeightVisibilityQuery.result),
      audit: cloneJson(directionalHeightVisibilityQuery.audit),
    });
    const illuminationVisibilityQuery = queryWorldSimulationObserverIlluminationVisibility({
      world_state: worldState,
      scene_state: sceneState,
      scene_id: sceneState.scene_id ?? event.scene_id ?? event.location_id ?? null,
      observer: character,
    });
    illuminationVisibilityQueries.push({
      observer: character,
      version: illuminationVisibilityQuery.illumination_visibility_version,
      result: cloneJson(illuminationVisibilityQuery.result),
      audit: cloneJson(illuminationVisibilityQuery.audit),
    });
    const audibilityQuery = queryWorldSimulationObserverAudibility({
      world_state: worldState,
      scene_state: sceneState,
      scene_id: sceneState.scene_id ?? event.scene_id ?? event.location_id ?? null,
      observer: character,
    });
    audibilityQueries.push({
      observer: character,
      version: audibilityQuery.audibility_query_version,
      result: cloneJson(audibilityQuery.result),
      audit: cloneJson(audibilityQuery.audit),
    });
    const perception = await capability(
      sessionId,
      "world_perception_filter",
      {
        character,
        scene_state: sceneState,
        simulation_time: worldState.simulation_time ?? event.simulation_time ?? null,
        programmatic_visibility: {
          enforced: true,
          version: illuminationVisibilityQuery.illumination_visibility_version,
          base_visibility_version: visibilityQuery.visibility_query_version,
          directional_height_visibility_version: directionalHeightVisibilityQuery.directional_height_visibility_version,
          directional_height_visibility_enforced: true,
          illumination_visibility_enforced: illuminationVisibilityQuery.result.lighting_enforced === true,
          visual_observations: cloneJson(
            illuminationVisibilityQuery.result.perception_visual_observations,
          ),
        },
        programmatic_audibility: {
          enforced: audibilityQuery.result.audibility_enforced === true,
          version: audibilityQuery.audibility_query_version,
          auditory_observations: cloneJson(
            audibilityQuery.result.perception_auditory_observations,
          ),
        },
      },
      options,
      traceIds,
    );
    const characterPerception = cloneJson(
      perception.character_view
      ?? {
        character,
        observed: perception.observed ?? [],
        audible: perception.audible ?? [],
        other_senses: perception.other_senses ?? [],
        information_boundary: perception.information_boundary ?? {},
      },
    );

    const memoryAccessibilityBaseInput = {
      world_state:
        cloneJson(
          worldState,
        ),
      character,
      memory_records:
        cloneJson(
          retrievalMemoryRecords,
        ),
      simulation_time:
        worldState.simulation_time
        ?? event.simulation_time
        ?? null,
      scene_id:
        sceneState.scene_id
        ?? event.scene_id
        ?? event.location_id
        ?? null,
      perception:
        cloneJson(
          characterPerception,
        ),

      context_cues:
        cloneJson(
          object(
            event.memory_context_cues,
          ),
        ),

      retrieval_context:
        cloneJson(
          object(
            event.memory_retrieval_context,
          ),
        ),
    };

    const memoryAccessibilityQuery =
      queryWorldSimulationMemoryAccessibility(
        memoryAccessibilityBaseInput,
      );
    const cueDiagnosticEvidenceProjection =
      projectWorldSimulationCueDiagnosticEvidence({
        memory_accessibility_query:
          memoryAccessibilityQuery,
      });
    memoryAccessibilityQueries.push({
      observer: character,
      version: memoryAccessibilityQuery.memory_accessibility_version,
      result: cloneJson(memoryAccessibilityQuery.result),
      audit: cloneJson(memoryAccessibilityQuery.audit),
      retrieval_practice_activation_projection:
        cloneJson(
          retrievalPracticeActivationProjection.audit,
        ),
      base_level_activation_projection:
        cloneJson(
          baseLevelActivationProjection.audit,
        ),
      query_relative_cue_diagnostic_evidence_projection:
        cloneJson(
          cueDiagnosticEvidenceProjection.audit,
        ),
    });
    const memoryProjectionPolicy =
      memoryProjectionPolicyFor(
        event,
        character,
        memoryAccessibilityQuery.result,
      );

    const authoritativeCandidateRecords =
      cloneJson(
        memoryAccessibilityQuery
          .result
          .candidate_memory_records,
      );

    const retrievalContext =
      object(
        event.memory_retrieval_context,
      );

    const stagedMemoryRetrievalResolver =
      typeof options.memoryRetrievalStageResolver === "function"
        ? options.memoryRetrievalStageResolver
        : null;

    let memoryRetrievalQuery;
    let memoryRetrievalProcess;
    let memoryRetrievalResolutionAudit;

    if (stagedMemoryRetrievalResolver) {
      memoryRetrievalQuery =
        buildWorldSimulationMemoryRetrievalQueryV3({
          character,
          turn_id:
            turnId,
          phase63b_version:
            memoryAccessibilityQuery
              .memory_accessibility_version,
          memory_records:
            retrievalMemoryRecords,
          accessibility_base_input:
            memoryAccessibilityBaseInput,
          initial_accessibility_query:
            memoryAccessibilityQuery,
          initial_cue_diagnostic_projection:
            cueDiagnosticEvidenceProjection,
          retrieval_goal:
            retrievalContext
              .retrieval_goal
            ?? null,
        });

      memoryRetrievalProcess =
        await executeWorldSimulationMemoryRetrievalProcessV3({
          query:
            memoryRetrievalQuery,
          memory_records:
            retrievalMemoryRecords,
          accessibility_base_input:
            memoryAccessibilityBaseInput,
          initial_accessibility_query:
            memoryAccessibilityQuery,
          initial_base_level_activation_projection:
            baseLevelActivationProjection,
          initial_cue_diagnostic_projection:
            cueDiagnosticEvidenceProjection,
          resolver:
            stagedMemoryRetrievalResolver,
          technical_step_budget:
            options.memoryRetrievalTechnicalStepBudget,
          perception:
            characterPerception,
          character_state:
            characterState,
        });

      memoryRetrievalResolutionAudit = {
        resolver_used:
          true,
        staged_lifecycle:
          true,
        stage_audit:
          cloneJson(
            memoryRetrievalProcess
              .resolver_audit
            ?? [],
          ),
        world_state_exposed_to_resolver:
          false,
        full_world_event_exposed_to_resolver:
          false,
        future_frontier_content_exposed_to_earlier_stage:
          false,
        associative_activation_composition_evidence_exposed_to_resolver:
          false,
        retrieval_competition_monitoring_evidence_exposed_to_resolver:
          false,
        retrieval_search_control_readiness_evidence_exposed_to_resolver:
          false,
        grounded_retrieval_cue_construction_evidence_exposed_to_resolver:
          false,
        retrieval_episode_local_reprojection_evidence_exposed_to_resolver:
          false,
        retrieval_global_termination_decision_evidence_exposed_to_resolver:
          false,
        global_termination_r4d_consumed_online:
          false,
        r4d_used_during_episode_local_reprojection:
          false,
        cue_construction_character_state_exposed:
          false,
        cue_construction_full_memory_records_exposed:
          false,
        cue_construction_unrecovered_memory_content_exposed:
          false,
        cue_construction_world_state_exposed:
          false,
        cue_construction_future_event_queue_exposed:
          false,
        resolver_may_author_recovered_content:
          false,
        resolver_may_author_reinstated_cue_content:
          false,
      };
    } else {
      memoryRetrievalQuery =
        buildWorldSimulationMemoryRetrievalQuery({
          character,

          turn_id:
            turnId,

          phase63b_version:
            memoryAccessibilityQuery
              .memory_accessibility_version,

          candidate_memory_records:
            authoritativeCandidateRecords,

          initial_cues:
            array(
              retrievalContext
                .active_cues,
            ),

          retrieval_goal:
            retrievalContext
              .retrieval_goal
            ?? null,
        });

      const memoryRetrievalResolution =
        await resolveMemoryRetrievalResolution(
          {
            character,
            query:
              memoryRetrievalQuery,
            candidate_memory_records:
              authoritativeCandidateRecords,
            candidate_evaluations:
              memoryAccessibilityQuery
                .result
                .candidate_evaluations
              ?? [],
            perception:
              characterPerception,
            character_state:
              characterState,
          },
          options,
        );

      memoryRetrievalProcess =
        executeWorldSimulationMemoryRetrievalProcess({
          query:
            memoryRetrievalQuery,
          candidate_memory_records:
            authoritativeCandidateRecords,
          resolution:
            memoryRetrievalResolution.resolution,
        });

      memoryRetrievalResolutionAudit =
        cloneJson(
          memoryRetrievalResolution.audit,
        );
    }

    memoryRetrievalQueries.push({
      observer:
        character,

      version:
        memoryRetrievalProcess.version,

      query:
        cloneJson(
          memoryRetrievalQuery,
        ),
    });

    memoryRetrievalProcesses.push({
      observer:
        character,
      version:
        memoryRetrievalProcess.version,
      resolution_audit:
        cloneJson(
          memoryRetrievalResolutionAudit,
        ),
      result:
        cloneJson(
          memoryRetrievalProcess,
        ),
    });

    // Step 2 preserves the legacy projector invocation for
    // compatibility and neural trace continuity, but its output
    // is engine-only in the native world-loop path.
    const legacyMemoryProjection = await capability(
      sessionId,
      "world_memory_retriever",
      {
        character,

        memory_records:
          memories,

        query:
          event.memory_query
          ?? event.summary
          ?? event.type
          ?? null,

        projection_max_items:
          memoryProjectionPolicy
            .max_items
          ?? undefined,

        projection_policy_origin:
          memoryProjectionPolicy
            .origin,

        programmatic_memory_accessibility: {
          candidate_set_authoritative:
            true,

          accessibility_enforced:
            memoryAccessibilityQuery
              .result
              .accessibility_enforced
            === true,

          // Deprecated compatibility field retained for
          // capability consumers that still inspect it.
          enforced:
            memoryAccessibilityQuery
              .result
              .accessibility_enforced
            === true,

          version:
            memoryAccessibilityQuery
              .memory_accessibility_version,

          candidate_memory_records:
            authoritativeCandidateRecords,

          // Deprecated compatibility alias.
          memory_records:
            cloneJson(
              authoritativeCandidateRecords,
            ),
        },
      },
      options,
      traceIds,
    );
    // Phase63C Step 3 accepts only content that the actual
    // retrieval kernel materialized from the frozen candidate set.
    const recoveredMemories =
      cloneJson(
        memoryRetrievalProcess
          .recovered_memories
        ?? [],
      );

    const retrievalExperience =
      cloneJson(
        memoryRetrievalProcess
          .retrieval_experience
        ?? {
          process_occurred: false,
          initiation_mode: null,
          target_outcome: null,
          recovered_any_content: false,
        },
      );

    // Character Runtime v2 owns the current situational workspace. This is a
    // speculative transition only: it cannot mutate committed Current Mind
    // before the atomic world commit succeeds.
    const speculativeCurrentMind =
      await characterRuntimeManager.prepareSpeculativeCurrentMind(
        {
          world_simulation_session_id: sessionId,
          turn_id: turnId,
          character,
          simulation_time:
            worldState.simulation_time
            ?? event.simulation_time
            ?? null,
          perception: characterPerception,
          recovered_memories: recoveredMemories,
          current_action:
            characterState.current_action
            ?? null,
          compatibility_state: {
            attention:
              characterState.attention
              ?? null,
            goals:
              characterState.goals
              ?? [],
            current_goals:
              characterState.current_goals
              ?? [],
            current_goal:
              characterState.current_goal
              ?? null,
            temporary_expectation:
              characterState.temporary_expectation
              ?? characterState.expectation
              ?? null,
          },
        },
        options,
      );

    attentionEncodingEvidence.push({
      character,
      evidence: cloneJson(speculativeCurrentMind.encoding_evidence),
    });
    currentMindTransitionProjections.push({
      character,
      projection: cloneJson(speculativeCurrentMind.projection),
    });

    const cognition = await capability(
      sessionId,
      "world_character_cognition",
      {
        character,
        character_state: characterState,
        perception: characterPerception,

        recovered_memories:
          recoveredMemories,

        retrieval_experience:
          retrievalExperience,

        attention:
          speculativeCurrentMind.character_facing_attention,

        working_context:
          speculativeCurrentMind.working_context,

        current_action:
          characterState.current_action
          ?? null,
      },
      options,
      traceIds,
    );
    const characterCognition = cloneJson(
      cognition.character_view
      ?? cognition,
    );
    const actionCandidates = await capability(
      sessionId,
      "world_action_proposer",
      {
        character,
        available_actions: availableActions,
        cognition: characterCognition,
        current_action: characterState.current_action ?? null,
      },
      options,
      traceIds,
    );
    const characterActionCandidates = cloneJson(
      actionCandidates.character_view
      ?? actionCandidates,
    );
    decisionPackets.push({
      character,

      perception:
        cloneJson(
          characterPerception,
        ),

      recovered_memories:
        cloneJson(
          recoveredMemories,
        ),

      // Deprecated compatibility alias. In the native Phase63C
      // path this aliases actually recovered content only and
      // never aliases Phase63B projected candidate content.
      retrieved_memories:
        cloneJson(
          recoveredMemories,
        ),

      retrieval_experience:
        cloneJson(
          retrievalExperience,
        ),

      cognition:
        cloneJson(
          characterCognition,
        ),

      candidate_action_intents:
        cloneJson(
          characterActionCandidates.candidate_action_intents,
        ),
      action_consideration:
        cloneJson(
          characterActionCandidates.neural_consideration
          ?? null,
        ),
      boundaries: {
        world_truth_exposed: false,
        r1_character_facing_envelopes_enforced: true,
        engine_simulation_time_exposed: false,
        engine_scene_id_exposed: false,
        capability_contract_metadata_exposed: false,
        capability_runtime_metadata_exposed: false,
        raw_world_event_exposed: false,
        engine_event_identity_exposed: false,
        engine_session_identity_exposed: false,
        engine_turn_identity_exposed: false,
        may_choose_action_intent_only: true,
        may_decide_outcome: false,
        programmatic_visibility_enforced: true,
        directional_height_visibility_enforced: true,
        illumination_visibility_enforced: illuminationVisibilityQuery.result.lighting_enforced === true,
        programmatic_audibility_enforced: audibilityQuery.result.audibility_enforced === true,
        programmatic_memory_accessibility_enforced:
          memoryAccessibilityQuery
            .result
            .accessibility_enforced
          === true,

        memory_accessibility_candidate_set_authoritative:
          true,

        memory_context_is_projection_not_successful_retrieval:
          true,

        candidate_content_barrier_enforced:
          true,

        unretrieved_candidate_content_exposed_to_character_brain:
          false,

        native_character_brain_memory_channel:
          "recovered_memories",

        recovered_memory_count:
          recoveredMemories.length,

        native_retrieval_process_execution_installed:
          true,

        retrieval_process_occurred:
          retrievalExperience
            .process_occurred
          === true,

        retrieval_target_outcome:
          retrievalExperience
            .target_outcome
          ?? null,

        legacy_memory_projection_engine_only:
          true,

        memory_projection_max_items:
          legacyMemoryProjection
            .projection_max_items,

        memory_projection_budget_is_cognitive_capacity:
          false,

        memory_retrieval_strength_scores_exposed:
          false,
        engine_visibility_target_ids_exposed: false,
        engine_sound_source_ids_exposed: false,
      },
    });
  }

  return {
    ok: true,
    loop_version: worldSimulationLoopVersion,
    world_simulation_session_id: sessionId,
    turn_id: turnId,
    state_revision: snapshot.revision,
    world_state_hash: snapshot.state_hash,
    event,
    scene_analysis: cloneJson(sceneAnalysis),
    decision_packets: decisionPackets,
    attention_encoding_evidence: cloneJson(attentionEncodingEvidence),
    current_mind_transition_projections: cloneJson(currentMindTransitionProjections),
    visibility_queries: visibilityQueries,
    directional_height_visibility_queries: directionalHeightVisibilityQueries,
    illumination_visibility_queries: illuminationVisibilityQueries,
    audibility_queries: audibilityQueries,
    memory_accessibility_queries: memoryAccessibilityQueries,
    memory_retrieval_queries: memoryRetrievalQueries,
    memory_retrieval_processes: memoryRetrievalProcesses,
    trace_ids: traceIds,
    causal_boundary: {
      world_state_not_returned_to_character_brain: true,
      character_brain_selects_intent_only: true,
      character_brain_receives_engine_simulation_time: false,
      character_brain_receives_engine_scene_id: false,
      character_brain_receives_capability_runtime_metadata: false,
      character_brain_receives_raw_world_event: false,
      character_brain_receives_session_or_turn_identity: false,
      character_facing_capability_envelopes_enforced: true,
      causal_adjudicator_has_exclusive_outcome_authority: true,
      scene_neural_advisory_forwarded_to_causal_adjudicator: false,
      consistency_neural_advisory_controls_commit_gate: false,
      programmatic_visibility_query_version: worldSimulationVisibilityQueryVersion,
      directional_height_visibility_query_version: worldSimulationDirectionalHeightVisibilityVersion,
      illumination_visibility_query_version: worldSimulationIlluminationVisibilityVersion,
      audibility_query_version: worldSimulationAudibilityQueryVersion,
      subjective_memory_formation_version: worldSimulationSubjectiveMemoryFormationVersion,
      subjective_memory_accessibility_version: worldSimulationMemoryAccessibilityVersion,

      subjective_memory_uses_bounded_perception_only:
        true,

      memory_accessibility_candidate_set_is_projection_input:
        true,

      memory_accessibility_candidate_set_is_engine_only_in_native_loop:
        true,

      candidate_content_barrier_enforced:
        true,

      native_character_brain_memory_channel:
        "recovered_memories",

      native_retrieval_process_execution_installed:
        true,

      missing_retrieval_resolver_means_no_process:
        true,

      legacy_projected_memory_content_forwarded_to_character_brain:
        false,

      memory_projection_budget_separate_from_accessibility:
        true,

      memory_projection_asserts_successful_retrieval:
        false,

      memory_accessibility_scores_not_forwarded_to_character_brain:
        true,
      visibility_engine_target_ids_not_forwarded_to_character_brain: true,
      sound_engine_source_ids_not_forwarded_to_character_brain: true,
    },
  };
}

async function resolveMemoryEncodingDecisions(
  preparedTurn,
  options,
) {
  const decider =
    typeof options.memoryEncodingDecider === "function"
      ? options.memoryEncodingDecider
      : null;

  if (!decider) {
    return {
      decisions: [],
      audit: {
        decider_used: false,

        missing_decider_preserved_legacy_encoding:
          true,

        bounded_character_information_only:
          true,

        world_state_exposed_to_decider:
          false,

        full_world_event_exposed_to_decider:
          false,

        character_brain_direct_memory_mutation_allowed:
          false,
      },
    };
  }

  // The encoding decider receives only already-bounded
  // per-character information.
  //
  // It does NOT receive:
  // - World State
  // - scene state
  // - raw event payload
  // - hidden causal data
  const input = {
    turn_id:
      preparedTurn.turn_id,

    character_packets:
      array(preparedTurn.decision_packets)
        .map((packet) => ({
          character:
            packet.character
            ?? null,

          perception:
            cloneJson(
              packet.perception
              ?? {},
            ),

          cognition:
            cloneJson(
              packet.cognition
              ?? {},
            ),

          attention_encoding_evidence:
            cloneJson(
              array(preparedTurn.attention_encoding_evidence).find(
                (item) => sameCharacterName(item?.character, packet.character),
              )?.evidence
              ?? packet.attention_encoding_evidence
              ?? [],
            ),
        })),
  };

  const inputSnapshot =
    cloneJson(input);

  const inputHash =
    hashAgentRunValue(inputSnapshot);

  // The decider receives a detached clone. Any mutation
  // performed by the callee cannot mutate engine-owned input.
  const raw =
    await decider(
      cloneJson(inputSnapshot),
    );

  if (!Array.isArray(raw)) {
    const error = new Error(
      "memoryEncodingDecider must return an array of explicit encoding decisions.",
    );

    error.code =
      "WORLD_SIMULATION_MEMORY_ENCODING_DECIDER_INVALID_OUTPUT";

    throw error;
  }

  return {
    decisions:
      cloneJson(raw),

    audit: {
      decider_used: true,

      input_context_hash:
        inputHash,

      decision_count:
        raw.length,

      bounded_character_information_only:
        true,

      world_state_exposed_to_decider:
        false,

      full_world_event_exposed_to_decider:
        false,

      character_brain_direct_memory_mutation_allowed:
        false,
    },
  };
}

async function resolveMemoryEpisodeBindings(
  preparedTurn,
  encodingDecisions,
  options,
) {
  const binder =
    typeof options.memoryEpisodeBinder === "function"
      ? options.memoryEpisodeBinder
      : null;

  if (!binder) {
    return {
      bindings: [],

      audit: {
        binder_used:
          false,

        automatic_segmentation_used:
          false,

        world_state_exposed_to_binder:
          false,

        full_world_event_exposed_to_binder:
          false,

        world_event_identity_auto_used:
          false,

        missing_binder_preserves_unbound_atomic_traces:
          true,
      },
    };
  }

  const input = {
    turn_id:
      preparedTurn.turn_id,

    character_packets:
      array(preparedTurn.decision_packets)
        .map((packet) => ({
          character:
            packet.character
            ?? null,

          perception:
            cloneJson(
              packet.perception
              ?? {},
            ),

          cognition:
            cloneJson(
              packet.cognition
              ?? {},
            ),
        })),

    encoding_decisions:
      cloneJson(
        encodingDecisions.decisions
        ?? [],
      ),
  };

  const inputSnapshot =
    cloneJson(input);

  const inputHash =
    hashAgentRunValue(inputSnapshot);

  // The binder receives a detached clone. Any mutation
  // performed by the callee cannot mutate engine-owned input.
  const raw =
    await binder(
      cloneJson(inputSnapshot),
    );

  if (!Array.isArray(raw)) {
    const error = new Error(
      "memoryEpisodeBinder must return an array of explicit subjective episode bindings.",
    );

    error.code =
      "WORLD_SIMULATION_MEMORY_EPISODE_BINDER_INVALID_OUTPUT";

    throw error;
  }

  return {
    bindings:
      cloneJson(raw),

    audit: {
      binder_used:
        true,

      input_context_hash:
        inputHash,

      binding_count:
        raw.length,

      automatic_segmentation_used:
        false,

      world_state_exposed_to_binder:
        false,

      full_world_event_exposed_to_binder:
        false,

      world_event_identity_auto_used:
        false,

      character_brain_direct_episode_binding_allowed:
        false,
    },
  };
}

export async function resolveWorldSimulationTurn(
  preparedTurn,
  selectedActions,
  options = {},
) {
  if (!isObject(preparedTurn)) throw new Error("preparedTurn must be an object.");
  const sessionId = nonEmptyString(
    preparedTurn.world_simulation_session_id,
    "preparedTurn.world_simulation_session_id",
  );
  await assertWorldSimulationSession(sessionId, options);
  const snapshot = await getWorldSimulationState(sessionId, options);
  if (snapshot.revision !== preparedTurn.state_revision
    || snapshot.state_hash !== preparedTurn.world_state_hash) {
    const stale = new Error("Prepared world turn is stale and cannot be adjudicated.");
    stale.code = "WORLD_SIMULATION_PREPARED_TURN_STALE";
    throw stale;
  }
  const causalAdjudicator = typeof options.causalAdjudicator === "function"
    ? options.causalAdjudicator
    : adjudicateWorldSimulationCausality;

  const selected = [];
  for (const packet of array(preparedTurn.decision_packets)) {
    const character = nonEmptyString(packet.character, "decision packet character");
    selected.push(candidateSelection(
      { candidate_action_intents: packet.candidate_action_intents },
      characterMapValue(selectedActions, character),
      character,
    ));
  }

  const preAdjudicationHash = hashAgentRunValue(snapshot.state);
  const causalResolution = assertCausalResolution(await causalAdjudicator({
    world_simulation_session_id: sessionId,
    turn_id: preparedTurn.turn_id,
    world_state: cloneJson(snapshot.state),
    world_state_revision: snapshot.revision,
    world_state_hash: snapshot.state_hash,
    event: cloneJson(preparedTurn.event),
    scene_analysis: cloneJson(
      preparedTurn.scene_analysis?.trusted_execution_view
      ?? preparedTurn.scene_analysis,
    ),
    selected_action_intents: cloneJson(selected),
  }));
  if (hashAgentRunValue(snapshot.state) !== preAdjudicationHash) {
    throw new Error("causalAdjudicator mutated the persisted input snapshot in place.");
  }

  const traceIds = [...array(preparedTurn.trace_ids)];
  const consistency = await capability(
    sessionId,
    "world_consistency_critic",
    {
      state_transitions: array(causalResolution.state_transitions),
      object_holders: array(causalResolution.object_holders),
      knowledge_transitions: array(causalResolution.knowledge_transitions),
      action_outcomes: array(causalResolution.action_outcomes),
    },
    options,
    traceIds,
  );

  const consistencyCommitGate =
    consistency.commit_gate_view
    ?? consistency;

  if ((consistencyCommitGate.hard_conflict_count ?? 0) > 0) {
    return {
      ok: false,
      committed: false,
      world_simulation_session_id: sessionId,
      turn_id: preparedTurn.turn_id,
      previous_state_hash: snapshot.state_hash,
      next_state_hash: null,
      selected_action_intents: selected,
      consistency,
      trace_ids: traceIds,
      blocked_reason: "world_consistency_critic_reported_hard_conflicts",
      causal_resolution_discarded: true,
    };
  }

  const retrievalOccurredAt =
    array(preparedTurn.decision_packets)
      .map((packet) =>
        packet?.perception?.simulation_time
        ?? null
      )
      .find((value) =>
        value !== null
        && value !== undefined
      )
    ?? preparedTurn.event?.simulation_time
    ?? snapshot.state?.simulation_time
    ?? null;

  const subjectiveMemoryRetrievalPersistence =
    buildWorldSimulationMemoryRetrievalPersistence({
      world_state:
        causalResolution.next_world_state,
      turn_id:
        preparedTurn.turn_id,
      occurred_at:
        retrievalOccurredAt,
      retrieval_processes:
        preparedTurn.memory_retrieval_processes
        ?? [],
    });

  const subjectiveMemoryRetrievalMutationQueue =
    buildWorldSimulationChronologicalMutationQueue({
      turn_id:
        `${preparedTurn.turn_id}:retrieval_history`,
      world_state_hash:
        hashAgentRunValue(
          causalResolution.next_world_state,
        ),
      state_transitions:
        subjectiveMemoryRetrievalPersistence
          .result
          .state_transitions,
      elapsed_ms: 0,
    });

  const subjectiveMemoryRetrievalMutationExecution =
    executeWorldSimulationChronologicalMutationQueue({
      world_state:
        causalResolution.next_world_state,
      preview_world_state:
        subjectiveMemoryRetrievalPersistence
          .result
          .preview_world_state,
      queue:
        subjectiveMemoryRetrievalMutationQueue,
      scene_id:
        preparedTurn.event?.scene_id
        ?? preparedTurn.event?.location_id
        ?? null,
    });

  const retrievalPersistedWorldState =
    subjectiveMemoryRetrievalMutationExecution
      .next_world_state;

  const subjectiveMemoryEncodingDecisions =
    await resolveMemoryEncodingDecisions(
      preparedTurn,
      options,
    );

  const subjectiveMemoryEpisodeBindings =
    await resolveMemoryEpisodeBindings(
      preparedTurn,
      subjectiveMemoryEncodingDecisions,
      options,
    );

  const subjectiveMemoryFormation =
    formWorldSimulationSubjectiveMemories({
      world_state:
        retrievalPersistedWorldState,

      turn_id:
        preparedTurn.turn_id,

      event:
        preparedTurn.event,

      decision_packets:
        preparedTurn.decision_packets,

      encoding_decisions:
        subjectiveMemoryEncodingDecisions.decisions,

      episode_bindings:
        subjectiveMemoryEpisodeBindings.bindings,
    });
  const subjectiveMemoryPreview = applySubjectiveMemoryPreview(
    retrievalPersistedWorldState,
    subjectiveMemoryFormation.result,
  );
  const subjectiveMemoryMutationQueue = buildWorldSimulationChronologicalMutationQueue({
    turn_id: `${preparedTurn.turn_id}:subjective_memory`,
    world_state_hash: hashAgentRunValue(retrievalPersistedWorldState),
    state_transitions: subjectiveMemoryFormation.result.memory_transitions,
    elapsed_ms: 0,
  });
  const subjectiveMemoryMutationExecution = executeWorldSimulationChronologicalMutationQueue({
    world_state: retrievalPersistedWorldState,
    preview_world_state: subjectiveMemoryPreview,
    queue: subjectiveMemoryMutationQueue,
    scene_id: preparedTurn.event?.scene_id ?? preparedTurn.event?.location_id ?? null,
  });

  const characterRuntimeManager = options.characterRuntimeManager
    ?? defaultWorldSimulationCharacterRuntimeManager;
  if (typeof characterRuntimeManager?.inspectRuntime !== "function"
    || typeof characterRuntimeManager?.deliverCommittedCurrentMindProjection !== "function"
    || typeof characterRuntimeManager?.deliverCommittedExperienceProjection !== "function") {
    throw new Error(
      "characterRuntimeManager must provide inspectRuntime(), deliverCommittedCurrentMindProjection(), and deliverCommittedExperienceProjection().",
    );
  }
  const committedHistoryBeforeTurn = await getWorldSimulationHistory(
    sessionId,
    options,
  );
  const committedCharacterRuntimeIdentities = [];
  for (const packet of array(preparedTurn.decision_packets)) {
    const runtimeSnapshot = await characterRuntimeManager.inspectRuntime(
      {
        world_simulation_session_id: sessionId,
        character: packet.character,
      },
      options,
    );
    committedCharacterRuntimeIdentities.push({
      character: packet.character,
      world_lineage: runtimeSnapshot.world_lineage,
      character_entity_id: runtimeSnapshot.character_entity_id,
      canonical_name: runtimeSnapshot.canonical_name,
      identity_source: runtimeSnapshot.identity_source,
      formal_identity: runtimeSnapshot.formal_identity === true,
      experience_sequence: nextCommittedCharacterExperienceSequence(
        committedHistoryBeforeTurn,
        runtimeSnapshot.world_lineage,
        runtimeSnapshot.character_entity_id,
      ),
    });
  }

  // This is still speculative cognitive evidence. Runtime committed Current
  // Mind remains unchanged until the atomic world commit below succeeds.
  const committedCharacterCurrentMindProjection =
    projectWorldSimulationCharacterCurrentMindTransitions({
      prepared_turn: preparedTurn,
    });

  // This projection is only commit evidence at this point. No Character
  // Experience Receipt exists until the atomic world commit below succeeds.
  const committedCharacterExperienceProjection =
    projectWorldSimulationCharacterExperienceEvidence({
      prepared_turn: preparedTurn,
      selected_action_intents: selected,
      action_outcomes: array(causalResolution.action_outcomes),
      runtime_identities: committedCharacterRuntimeIdentities,
    });

  const committed = await commitWorldSimulationTurn(
    sessionId,
    {
      expected_revision: snapshot.revision,
      expected_state_hash: snapshot.state_hash,
      turn_id: preparedTurn.turn_id,
      next_world_state: subjectiveMemoryMutationExecution.next_world_state,
      event: preparedTurn.event,
      selected_action_intents: selected,
      state_transitions: array(causalResolution.state_transitions),
      action_outcomes: array(causalResolution.action_outcomes),
      knowledge_transitions: array(causalResolution.knowledge_transitions),
      scheduled_events: array(causalResolution.scheduled_events),
      causal_timeline: cloneJson(causalResolution.causal_timeline ?? null),
      chronological_mutation_queue: cloneJson(causalResolution.chronological_mutation_queue ?? null),
      chronological_mutation_execution: cloneJson(causalResolution.chronological_mutation_execution ?? null),
      mutation_proposal_boundary: cloneJson(causalResolution.mutation_proposal_boundary ?? null),
      pure_proposal_producers: cloneJson(causalResolution.pure_proposal_producers ?? null),
      immutable_causal_evaluators: cloneJson(causalResolution.immutable_causal_evaluators ?? null),
      immutable_physics_effects: cloneJson(causalResolution.immutable_physics_effects ?? null),
      immutable_projectile_lifecycle: cloneJson(causalResolution.immutable_projectile_lifecycle ?? null),
      immutable_ability_field_lifecycle: cloneJson(causalResolution.immutable_ability_field_lifecycle ?? null),
      immutable_event_queries: cloneJson(causalResolution.immutable_event_queries ?? null),
      immutable_event_arbitration: cloneJson(causalResolution.immutable_event_arbitration ?? null),
      cross_layer_event_arbitration: cloneJson(causalResolution.cross_layer_event_arbitration ?? null),
      causal_epochs: cloneJson(causalResolution.causal_epochs ?? null),
      fixed_point_convergence: cloneJson(causalResolution.fixed_point_convergence ?? null),
      visibility_queries: cloneJson(preparedTurn.visibility_queries ?? []),
      directional_height_visibility_queries: cloneJson(
        preparedTurn.directional_height_visibility_queries ?? [],
      ),
      illumination_visibility_queries: cloneJson(preparedTurn.illumination_visibility_queries ?? []),
      audibility_queries: cloneJson(preparedTurn.audibility_queries ?? []),
      memory_accessibility_queries: cloneJson(preparedTurn.memory_accessibility_queries ?? []),

      subjective_memory_encoding_decisions:
        cloneJson(
          subjectiveMemoryEncodingDecisions,
        ),

      subjective_memory_episode_bindings:
        cloneJson(
          subjectiveMemoryEpisodeBindings,
        ),

      subjective_memory_retrieval_persistence:
        cloneJson(
          subjectiveMemoryRetrievalPersistence,
        ),
      subjective_memory_retrieval_mutation_queue:
        cloneJson(
          subjectiveMemoryRetrievalMutationQueue,
        ),
      subjective_memory_retrieval_mutation_execution:
        cloneJson(
          subjectiveMemoryRetrievalMutationExecution.execution,
        ),

      subjective_memory_formation:
        cloneJson(
          subjectiveMemoryFormation,
        ),
      subjective_memory_mutation_queue: cloneJson(subjectiveMemoryMutationQueue),
      subjective_memory_mutation_execution: cloneJson(subjectiveMemoryMutationExecution.execution),
      committed_character_current_mind_projection:
        cloneJson(committedCharacterCurrentMindProjection),
      committed_character_experience_projection:
        cloneJson(committedCharacterExperienceProjection),
      trace_ids: traceIds,
      causal_resolution_id: causalResolution.causal_resolution_id ?? null,
    },
    options,
  );

  let committedCurrentMindDelivery;
  try {
    committedCurrentMindDelivery = await characterRuntimeManager
      .deliverCommittedCurrentMindProjection(
        {
          world_simulation_session_id: sessionId,
          history_entry: committed.history_entry,
        },
        options,
      );
  } catch (error) {
    committedCurrentMindDelivery = {
      projection_version:
        committedCharacterCurrentMindProjection.projection_version,
      current_mind_contract_version:
        committedCharacterCurrentMindProjection.current_mind_contract_version,
      attention_reducer_version:
        committedCharacterCurrentMindProjection.attention_reducer_version,
      projection_hash:
        committedCharacterCurrentMindProjection.projection_hash,
      delivery_count:
        committedCharacterCurrentMindProjection.character_projections.length,
      consumed_count: 0,
      duplicate_count: 0,
      failed_count: 1,
      delivery_failed: true,
      replay_required: true,
      error_code: error?.code ?? "WORLD_SIMULATION_CHARACTER_CURRENT_MIND_DELIVERY_FAILED",
      error_message: error?.message ?? String(error),
    };
  }

  let committedExperienceDelivery;
  if (committedCurrentMindDelivery.replay_required === true) {
    // Preserve per-character cognitive ordering. Experience N is durable in
    // world history, but Runtime delivery waits until the missing Current Mind
    // transition N can be replayed first.
    committedExperienceDelivery = {
      projection_version:
        committedCharacterExperienceProjection.projection_version,
      experience_contract_version:
        committedCharacterExperienceProjection.experience_contract_version,
      projection_hash:
        committedCharacterExperienceProjection.projection_hash,
      delivery_count:
        committedCharacterExperienceProjection.character_projections.length,
      consumed_count: 0,
      duplicate_count: 0,
      failed_count: 0,
      delivery_failed: false,
      delivery_deferred: true,
      deferred_reason: "current_mind_delivery_requires_replay",
      replay_required: true,
    };
  } else {
    try {
      committedExperienceDelivery = await characterRuntimeManager
        .deliverCommittedExperienceProjection(
          {
            world_simulation_session_id: sessionId,
            history_entry: committed.history_entry,
          },
          options,
        );
    } catch (error) {
      // World commit is already authoritative. Preserve the replayable history
      // projection and surface post-commit delivery failure without pretending
      // the atomic world commit rolled back.
      committedExperienceDelivery = {
        projection_version:
          committedCharacterExperienceProjection.projection_version,
        experience_contract_version:
          committedCharacterExperienceProjection.experience_contract_version,
        projection_hash:
          committedCharacterExperienceProjection.projection_hash,
        delivery_count:
          committedCharacterExperienceProjection.character_projections.length,
        consumed_count: 0,
        duplicate_count: 0,
        failed_count: 1,
        delivery_failed: true,
        delivery_deferred: false,
        replay_required: true,
        error_code: error?.code ?? "WORLD_SIMULATION_CHARACTER_EXPERIENCE_DELIVERY_FAILED",
        error_message: error?.message ?? String(error),
      };
    }
  }

  return {
    ok: true,
    committed: true,
    world_simulation_session_id: sessionId,
    turn_id: preparedTurn.turn_id,
    revision: committed.state.revision,
    previous_state_hash: snapshot.state_hash,
    next_state_hash: committed.state.state_hash,
    selected_action_intents: selected,
    consistency,

    subjective_memory_encoding_decisions:
      cloneJson(
        subjectiveMemoryEncodingDecisions,
      ),

    subjective_memory_episode_bindings:
      cloneJson(
        subjectiveMemoryEpisodeBindings,
      ),

    subjective_memory_retrieval_persistence: {
      version:
        worldSimulationMemoryRetrievalPersistenceVersion,
      created_retrieval_event_count:
        subjectiveMemoryRetrievalPersistence
          .result
          .retrieval_events_created
          .length,
      history_update_count:
        subjectiveMemoryRetrievalPersistence
          .result
          .history_updates
          .length,
      mutation_count:
        subjectiveMemoryRetrievalMutationQueue
          .mutation_count,
      authoritative_executor:
        subjectiveMemoryRetrievalMutationExecution
          .execution
          .version,
    },

    subjective_memory_formation: {
      version: worldSimulationSubjectiveMemoryFormationVersion,
      created_memory_count: subjectiveMemoryFormation.result.created_memory_count,
      mutation_count: subjectiveMemoryMutationQueue.mutation_count,
      authoritative_executor: subjectiveMemoryMutationExecution.execution.version,
    },
    committed_character_current_mind: {
      current_mind_contract_version:
        committedCharacterCurrentMindProjection.current_mind_contract_version,
      attention_reducer_version:
        committedCharacterCurrentMindProjection.attention_reducer_version,
      projection_version:
        committedCharacterCurrentMindProjection.projection_version,
      projection_hash:
        committedCharacterCurrentMindProjection.projection_hash,
      transition_count:
        committedCharacterCurrentMindProjection.character_projections.length,
      delivered_count:
        committedCurrentMindDelivery.consumed_count ?? 0,
      duplicate_delivery_count:
        committedCurrentMindDelivery.duplicate_count ?? 0,
      delivery_failed:
        committedCurrentMindDelivery.delivery_failed === true,
      replay_required:
        committedCurrentMindDelivery.replay_required === true,
      established_after_world_commit: true,
      persistent_mind_learning_installed: false,
      durable_mind_mutation_count: 0,
    },
    committed_character_experience: {
      experience_contract_version:
        committedCharacterExperienceProjection.experience_contract_version,
      projection_version:
        committedCharacterExperienceProjection.projection_version,
      projection_hash:
        committedCharacterExperienceProjection.projection_hash,
      receipt_count:
        committedCharacterExperienceProjection.character_projections.length,
      delivered_count:
        committedExperienceDelivery.consumed_count ?? 0,
      duplicate_delivery_count:
        committedExperienceDelivery.duplicate_count ?? 0,
      delivery_failed:
        committedExperienceDelivery.delivery_failed === true,
      delivery_deferred:
        committedExperienceDelivery.delivery_deferred === true,
      deferred_reason:
        committedExperienceDelivery.deferred_reason
        ?? null,
      replay_required:
        committedExperienceDelivery.replay_required === true,
      established_after_world_commit: true,
      durable_mind_mutation_count: 0,
    },
    trace_ids: traceIds,
    causal_resolution_id: causalResolution.causal_resolution_id ?? null,
    next_event: array(causalResolution.next_world_state.event_queue)[0] ?? null,
  };
}

export async function runWorldSimulationTurn(input = {}, options = {}) {
  if (typeof options.characterBrain !== "function") {
    const error = new Error("Phase62C requires a characterBrain function for named-character action choice.");
    error.code = "WORLD_SIMULATION_CHARACTER_BRAIN_REQUIRED";
    throw error;
  }
  const prepared = await prepareWorldSimulationTurn(input, options);
  const characterRuntimeManager = options.characterRuntimeManager
    ?? defaultWorldSimulationCharacterRuntimeManager;
  if (typeof characterRuntimeManager?.runCharacterTurn !== "function"
    || typeof characterRuntimeManager?.prepareSpeculativeCurrentMind !== "function"
    || typeof characterRuntimeManager?.inspectRuntime !== "function"
    || typeof characterRuntimeManager?.deliverCommittedCurrentMindProjection !== "function"
    || typeof characterRuntimeManager?.deliverCommittedExperienceProjection !== "function") {
    throw new Error(
      "characterRuntimeManager must provide Character Runtime v2 turn, Current Mind, inspection, and committed delivery methods.",
    );
  }
  const selections = {};
  for (const packet of prepared.decision_packets) {
    // Single-source Character Brain ingress projector. Runtime identity and
    // world-lineage metadata remain engine-side and are never added here.
    // Formal transport uses the same projector without the historical
    // retrieved_memories alias.
    const brainInput = buildWorldSimulationCharacterBrainInput(
      packet,
      {
        include_legacy_retrieved_memories_alias: true,
      },
    );
    selections[packet.character] = await characterRuntimeManager.runCharacterTurn(
      {
        world_simulation_session_id: prepared.world_simulation_session_id,
        character: packet.character,
        brain_input: brainInput,
        characterBrain: options.characterBrain,
      },
      options,
    );
  }
  return resolveWorldSimulationTurn(
    prepared,
    selections,
    {
      ...options,
      characterRuntimeManager,
    },
  );
}
