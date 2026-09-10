import {
  hashAgentRunValue,
} from "./agent-run-service.mjs";
import {
  buildWorldSimulationCharacterBrainInput,
} from "./world-simulation-character-brain-input-service.mjs";
import {
  buildWorldSimulationSubjectiveChoiceCommitmentReceiptContract,
  buildWorldSimulationSubjectiveChoiceCommitmentReceipts,
  worldSimulationSubjectiveChoiceCommitmentReceiptVersion,
} from "./world-simulation-subjective-choice-commitment-receipt-service.mjs";
import {
  adjudicateWorldSimulationCausality,
  buildWorldSimulationCausalRuleContract,
} from "./world-simulation-causal-rule-engine.mjs";
import {
  projectWorldSimulationPostOutcomeSubjectivePerception,
  worldSimulationPostOutcomeSubjectivePerceptionVersion,
} from "./world-simulation-post-outcome-subjective-perception-service.mjs";
import {
  bridgeWorldSimulationPostOutcomeSubjectiveExperienceToMemory,
  worldSimulationPostOutcomeSubjectiveMemoryBridgeVersion,
} from "./world-simulation-post-outcome-subjective-memory-bridge-service.mjs";
import {
  buildWorldSimulationExperienceGroundedSubjectiveLearningClaimProposals,
  buildWorldSimulationExperienceGroundedSubjectiveLearningResolverView,
  worldSimulationExperienceGroundedSubjectiveLearningVersion,
} from "./world-simulation-experience-grounded-subjective-learning-service.mjs";
import {
  buildWorldSimulationMultiExperienceSchemaEvidenceView,
  worldSimulationMultiExperienceSchemaEvidenceVersion,
} from "./world-simulation-multi-experience-schema-evidence-service.mjs";
import {
  buildWorldSimulationRelationalSchemaInductionResolverView,
  projectWorldSimulationRelationalSchemaInduction,
  worldSimulationRelationalSchemaInductionVersion,
} from "./world-simulation-relational-schema-induction-service.mjs";
import {
  buildWorldSimulationRelationalSchemaPromotionResolverView,
  projectWorldSimulationRelationalSchemaPromotion,
  worldSimulationRelationalSchemaPromotionVersion,
} from "./world-simulation-relational-schema-promotion-service.mjs";
import {
  buildWorldSimulationContextualSchemaRefinementEvidenceView,
  worldSimulationContextualSchemaRefinementEvidenceVersion,
} from "./world-simulation-contextual-schema-refinement-evidence-service.mjs";
import {
  buildWorldSimulationContextualSchemaSpecializationResolverView,
  projectWorldSimulationContextualSchemaSpecialization,
  worldSimulationContextualSchemaSpecializationVersion,
} from "./world-simulation-contextual-schema-specialization-service.mjs";
import {
  buildWorldSimulationContextualSchemaSpecializationAdmissionResolverView,
  projectWorldSimulationContextualSchemaSpecializationAdmission,
  worldSimulationContextualSchemaSpecializationAdmissionVersion,
} from "./world-simulation-contextual-schema-specialization-admission-service.mjs";
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
  buildWorldSimulationSubjectiveEpisodeSegmentationContract,
  buildWorldSimulationSubjectiveEpisodeSegmentations,
  worldSimulationSubjectiveEpisodeSegmentationVersion,
} from "./world-simulation-subjective-episode-segmentation-service.mjs";
import {
  buildWorldSimulationAutobiographicalLifeEventOrganizationContract,
  buildWorldSimulationAutobiographicalLifeEventOrganizations,
  buildWorldSimulationAutobiographicalLifeEventResolverView,
  worldSimulationAutobiographicalLifeEventVersion,
} from "./world-simulation-autobiographical-life-event-service.mjs";
import {
  buildWorldSimulationPersonalSemanticMemoryContract,
  buildWorldSimulationPersonalSemanticMemoryDerivations,
  buildWorldSimulationPersonalSemanticMemoryResolverView,
  worldSimulationPersonalSemanticMemoryVersion,
} from "./world-simulation-personal-semantic-memory-service.mjs";
import {
  buildWorldSimulationExperientialKnowledgeReentryContract,
  buildWorldSimulationExperientialKnowledgeReentryResolverView,
  projectWorldSimulationExperientialKnowledgeReentry,
  worldSimulationExperientialKnowledgeReentryVersion,
} from "./world-simulation-experiential-knowledge-reentry-service.mjs";
import {
  buildWorldSimulationExperientialMethodTransferContract,
  buildWorldSimulationExperientialMethodTransferResolverView,
  projectWorldSimulationExperientialMethodTransfer,
  worldSimulationExperientialMethodTransferVersion,
} from "./world-simulation-experiential-method-transfer-service.mjs";
import {
  buildWorldSimulationExperientialMethodCompetitionContract,
  projectWorldSimulationExperientialMethodCompetition,
  worldSimulationExperientialMethodCompetitionVersion,
} from "./world-simulation-experiential-method-competition-service.mjs";
import {
  buildWorldSimulationExperientialMethodCompetitionResolutionContract,
  buildWorldSimulationExperientialMethodCompetitionResolutionResolverView,
  projectWorldSimulationExperientialMethodCompetitionResolution,
  worldSimulationExperientialMethodCompetitionResolutionVersion,
} from "./world-simulation-experiential-method-competition-resolution-service.mjs";
import {
  buildWorldSimulationExperientialMethodCompetitionGuidanceContract,
  projectWorldSimulationExperientialMethodCompetitionGuidance,
  worldSimulationExperientialMethodCompetitionGuidanceVersion,
} from "./world-simulation-experiential-method-competition-guidance-service.mjs";
import {
  buildWorldSimulationExperientialMethodImpasseDeliberationContract,
  projectWorldSimulationExperientialMethodImpasseDeliberation,
  worldSimulationExperientialMethodImpasseDeliberationVersion,
} from "./world-simulation-experiential-method-impasse-deliberation-service.mjs";
import {
  buildWorldSimulationExperientialMethodImpasseDiscriminatingEvidenceContract,
  projectWorldSimulationExperientialMethodImpasseDiscriminatingEvidence,
  worldSimulationExperientialMethodImpasseDiscriminatingEvidenceVersion,
} from "./world-simulation-experiential-method-impasse-discriminating-evidence-service.mjs";
import {
  buildWorldSimulationExperientialMethodImpasseReresolutionContract,
  buildWorldSimulationExperientialMethodImpasseReresolutionResolverView,
  projectWorldSimulationExperientialMethodImpasseReresolution,
  worldSimulationExperientialMethodImpasseReresolutionVersion,
} from "./world-simulation-experiential-method-impasse-reresolution-service.mjs";
import {
  buildWorldSimulationExperientialMethodImpasseResolutionApplicationLineage,
  buildWorldSimulationExperientialMethodImpasseResolutionApplicationLineageContract,
} from "./world-simulation-experiential-method-impasse-resolution-application-lineage-service.mjs";
import {
  buildWorldSimulationExperientialMethodImpasseResolutionOutcomeEvidence,
  buildWorldSimulationExperientialMethodImpasseResolutionOutcomeEvidenceContract,
} from "./world-simulation-experiential-method-impasse-resolution-outcome-evidence-service.mjs";
import {
  buildWorldSimulationExperientialMethodImpassePrecedentReentryContract,
  projectWorldSimulationExperientialMethodImpassePrecedentReentry,
} from "./world-simulation-experiential-method-impasse-precedent-reentry-service.mjs";
import {
  buildWorldSimulationExperientialMethodImpassePrecedentReresolutionContract,
  buildWorldSimulationExperientialMethodImpassePrecedentReresolutionResolverView,
  projectWorldSimulationExperientialMethodImpassePrecedentReresolution,
} from "./world-simulation-experiential-method-impasse-precedent-reresolution-service.mjs";
import {
  buildWorldSimulationExperientialMethodApplicationLineageContract,
  buildWorldSimulationExperientialMethodCandidateAttributionResolverView,
  buildWorldSimulationSelectedExperientialMethodApplicationReceipts,
  projectWorldSimulationExperientialMethodCandidateAttribution,
  worldSimulationExperientialMethodApplicationLineageVersion,
} from "./world-simulation-experiential-method-application-lineage-service.mjs";
import {
  buildWorldSimulationExperientialMethodOutcomeCreditContract,
  buildWorldSimulationExperientialMethodOutcomeCreditResolverContext,
  projectWorldSimulationExperientialMethodOutcomeCredit,
  worldSimulationExperientialMethodOutcomeCreditVersion,
} from "./world-simulation-experiential-method-outcome-credit-service.mjs";
import {
  buildWorldSimulationAutobiographicalLifePeriodContract,
  buildWorldSimulationAutobiographicalLifePeriodOrganizations,
  buildWorldSimulationAutobiographicalLifePeriodResolverView,
  worldSimulationAutobiographicalLifePeriodVersion,
} from "./world-simulation-autobiographical-life-period-service.mjs";
import {
  buildWorldSimulationAutobiographicalSummaryProjectionContract,
  projectWorldSimulationAutobiographicalSummaryForCharacter,
  worldSimulationAutobiographicalSummaryCharacterProjectionVersion,
} from "./world-simulation-autobiographical-summary-projection-service.mjs";
import {
  autobiographicalSelfInterpretationCharacterProjectionVersion,
  buildWorldSimulationAutobiographicalSelfInterpretationContract,
  buildWorldSimulationAutobiographicalSelfInterpretationResolverView,
  buildWorldSimulationAutobiographicalSelfInterpretations,
  projectWorldSimulationAutobiographicalSelfInterpretationsForCharacter,
  worldSimulationAutobiographicalSelfInterpretationVersion,
} from "./world-simulation-autobiographical-self-interpretation-service.mjs";
import {
  buildWorldSimulationStructuredSelfModelAspects,
  buildWorldSimulationStructuredSelfModelContract,
  buildWorldSimulationStructuredSelfModelResolverView,
  projectWorldSimulationStructuredSelfModelForCharacter,
  structuredSelfModelCharacterProjectionVersion,
  worldSimulationStructuredSelfModelVersion,
} from "./world-simulation-structured-self-model-service.mjs";
import {
  buildWorldSimulationStructuredSelfModelRevisionContract,
  buildWorldSimulationStructuredSelfModelRevisionResolverView,
  buildWorldSimulationStructuredSelfModelRevisions,
  projectWorldSimulationRevisedStructuredSelfModelForCharacter,
  revisedStructuredSelfModelCharacterProjectionVersion,
  worldSimulationStructuredSelfModelRevisionVersion,
} from "./world-simulation-structured-self-model-revision-service.mjs";
import {
  buildWorldSimulationGoalImplementationIntentionActivationContract,
  buildWorldSimulationGoalImplementationIntentionActivationResolverView,
  projectWorldSimulationGoalImplementationIntentionActivation,
  worldSimulationGoalImplementationIntentionActivationVersion,
} from "./world-simulation-goal-implementation-intention-activation-service.mjs";
import {
  buildWorldSimulationGoalImplementationIntentionExecutionFeedback,
  buildWorldSimulationGoalImplementationIntentionExecutionFeedbackContract,
  buildWorldSimulationGoalImplementationIntentionExecutionFeedbackResolverView,
  worldSimulationGoalImplementationIntentionExecutionFeedbackVersion,
} from "./world-simulation-goal-implementation-intention-execution-feedback-service.mjs";
import {
  buildWorldSimulationGoalAchievementEvents,
  buildWorldSimulationGoalAchievementResolverView,
  buildWorldSimulationGoalAchievementVerificationContract,
  worldSimulationGoalAchievementVerificationVersion,
} from "./world-simulation-goal-achievement-verification-service.mjs";
import {
  buildWorldSimulationGoalUnattainabilityEvents,
  buildWorldSimulationGoalViabilityResolverView,
  buildWorldSimulationGoalViabilityUnattainabilityContract,
  worldSimulationGoalViabilityUnattainabilityVersion,
} from "./world-simulation-goal-viability-unattainability-service.mjs";
import {
  buildWorldSimulationGoalAdjustmentEvents,
  buildWorldSimulationGoalAdjustmentResolverView,
  buildWorldSimulationGoalDisengagementReengagementContract,
  worldSimulationGoalDisengagementReengagementVersion,
} from "./world-simulation-goal-disengagement-reengagement-service.mjs";
import {
  buildWorldSimulationAdaptiveReplanningEvents,
  buildWorldSimulationAdaptiveReplanningResolverView,
  worldSimulationAdaptiveReplanningVersion,
} from "./world-simulation-adaptive-replanning-service.mjs";
import {
  buildWorldSimulationMeansFeasibilityEvents,
  buildWorldSimulationMeansFeasibilityResolverView,
  worldSimulationMeansFeasibilityVersion,
} from "./world-simulation-means-feasibility-service.mjs";
import {
  buildWorldSimulationVisibleConstraintObservationContract,
  buildWorldSimulationVisibleConstraintObservations,
  projectWorldSimulationVisibleConstraintObservationsForCharacter,
  visibleConstraintObservationCharacterProjectionVersion,
  worldSimulationVisibleConstraintObservationVersion,
} from "./world-simulation-visible-constraint-observation-service.mjs";
import {
  buildWorldSimulationSubjectiveMeansFeasibilityClaimProposals,
  buildWorldSimulationSubjectiveMeansFeasibilityResolverView,
  worldSimulationSubjectiveMeansFeasibilityInterpretationVersion,
} from "./world-simulation-subjective-means-feasibility-interpretation-service.mjs";
import {
  buildWorldSimulationSubjectiveMeansFeasibilityLinkages,
  buildWorldSimulationSubjectiveMeansFeasibilityReconsiderationContract,
  worldSimulationSubjectiveMeansFeasibilityReconsiderationVersion,
} from "./world-simulation-subjective-means-feasibility-reconsideration-service.mjs";
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
  buildWorldSimulationMemoryPlasticity,
  buildWorldSimulationMemoryPlasticityContract,
  worldSimulationMemoryPlasticityVersion,
} from "./world-simulation-memory-plasticity-service.mjs";
import {
  buildWorldSimulationSubjectiveClaimProjectionContract,
  buildWorldSimulationSubjectiveClaimResolverView,
  buildWorldSimulationSubjectiveClaims,
  worldSimulationSubjectiveClaimProjectionVersion,
} from "./world-simulation-subjective-claim-projection-service.mjs";
import {
  buildWorldSimulationSubjectiveClaimConflictRevisionContract,
  buildWorldSimulationSubjectiveClaimConflictRevisionResolverView,
  buildWorldSimulationSubjectiveClaimConflictRevisions,
  worldSimulationSubjectiveClaimConflictRevisionProjectionVersion,
} from "./world-simulation-subjective-claim-conflict-revision-projection-service.mjs";
import {
  buildWorldSimulationSubjectiveCognitionProjectionContract,
  projectWorldSimulationSubjectiveCognition,
  worldSimulationSubjectiveCognitionProjectionVersion,
} from "./world-simulation-subjective-cognition-projection-service.mjs";
import {
  buildWorldSimulationSubjectiveBeliefResolutionContract,
  resolveWorldSimulationSubjectiveBeliefs,
  worldSimulationSubjectiveBeliefResolutionVersion,
} from "./world-simulation-subjective-belief-resolution-service.mjs";
import {
  buildWorldSimulationSubjectiveBeliefRevisionContract,
  buildWorldSimulationSubjectiveBeliefRevisions,
  worldSimulationSubjectiveBeliefRevisionVersion,
} from "./world-simulation-subjective-belief-revision-service.mjs";
import {
  buildWorldSimulationSubjectiveBeliefCharacterProjectionContract,
  projectWorldSimulationSubjectiveBeliefsForCharacter,
  worldSimulationSubjectiveBeliefCharacterProjectionVersion,
} from "./world-simulation-subjective-belief-character-projection-service.mjs";
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
export const worldSimulationCharacterRuntimeVersion = "character-runtime-v5";
export const worldSimulationCharacterExperienceContractVersion =
  "committed-character-experience-receipt-v1";
export const worldSimulationCharacterExperienceProjectionVersion =
  "committed-character-experience-projection-v1";
export const worldSimulationCharacterCurrentMindContractVersion =
  "character-current-mind-contract-v4";
export const worldSimulationCharacterAttentionReducerVersion =
  "deterministic-attention-reducer-v2";
export const worldSimulationCharacterWorkingMemoryOutputGateVersion =
  "deterministic-working-memory-output-gate-v1";
export const worldSimulationCharacterCurrentMindProjectionVersion =
  "committed-character-current-mind-projection-v4";

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
  "maintenance_evidence",
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

function currentMindRecoveredMemoryCharacterContext(memory) {
  const value = object(memory);
  const safe = {};
  for (const key of [
    "content_kind",
    "target_relation",
    "source",
    "memory_type",
    "perceptual_certainty_at_encoding",
    "perceptual_clarity_at_encoding",
    "possibly_incorrect",
    "source_confused",
  ]) {
    if (!Object.hasOwn(value, key)) continue;
    safe[key] = cloneJson(value[key]);
  }
  return sanitizeCurrentMindCharacterValue(safe);
}

function currentMindCharacterItem(candidate) {
  if (!isObject(candidate)) return null;
  const contextOrigin = candidate.source_kind === "committed_experience"
    || candidate.source_kind === "committed_action_experience"
    ? "committed_experience"
    : candidate.source_kind === "recovered_memory"
      ? "recovered_memory"
      : candidate.source_kind === "experiential_knowledge"
        ? "recalled_experiential_knowledge"
        : null;
  const recollectionContext = candidate.source_kind === "recovered_memory"
    ? sanitizeCurrentMindCharacterValue(candidate.character_context ?? {})
    : {};
  return {
    ...(contextOrigin ? { context_origin: contextOrigin } : {}),
    content: sanitizeCurrentMindCharacterValue(candidate.content),
    ...recollectionContext,
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
  characterContext = null,
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
  const boundedCharacterContext = isObject(characterContext)
    ? sanitizeCurrentMindCharacterValue(characterContext)
    : cloneJson(prior?.character_context ?? null);
  return {
    candidate_id: candidateId,
    source_kind: sourceKind,
    content: boundedContent,
    ...(isObject(boundedCharacterContext)
      && Object.keys(boundedCharacterContext).length > 0
      ? { character_context: boundedCharacterContext }
      : {}),
    activation_order: activationOrder,
    activated_at_sequence: currentMindSequence,
    last_seen_sequence: fresh
      ? currentMindSequence
      : Number(prior?.last_seen_sequence ?? currentMindSequence - 1),
    last_seen_simulation_time: fresh
      ? simulationTime
      : prior?.last_seen_simulation_time ?? null,
    source_ref: sourceRef ? cloneJson(sourceRef) : cloneJson(prior?.source_ref ?? null),
    maintenance_evidence: cloneJson(prior?.maintenance_evidence ?? null),
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
  const retrievalTargetRelevance = sourceKind === "recovered_memory"
    && currentMindStableText(raw.target_relation ?? null) === "target_related"
    ? 2
    : 0;
  const goalRelevance = sourceKind === "current_action"
    ? 3
    : Math.max(
      currentMindExplicitRank(
        raw.goal_relevance ?? raw.intention_relevance ?? raw.relevance,
        { low: 1, medium: 2, high: 3, critical: 3 },
      ),
      currentMindContentMatchesGoal(candidate.content, context.goal_texts) ? 2 : 0,
      retrievalTargetRelevance,
    );
  const priorMaintenanceEvidence = object(candidate.maintenance_evidence);
  const priorSupportedGoalTexts = array(priorMaintenanceEvidence.supported_goal_texts)
    .map((value) => currentMindText(value))
    .filter(Boolean);
  const currentSupportedGoalTexts = goalRelevance > 0
    ? [...new Set(
        array(context.goal_texts)
          .map((value) => currentMindText(value))
          .filter(Boolean),
      )]
    : [];
  const maintenanceEvidence = currentSupportedGoalTexts.length > 0
    ? { supported_goal_texts: currentSupportedGoalTexts }
    : priorSupportedGoalTexts.length > 0
      ? { supported_goal_texts: priorSupportedGoalTexts }
      : null;
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
    maintenance_evidence: cloneJson(maintenanceEvidence),
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

function currentMindAdmissionDecision(candidate, context) {
  const evidence = object(candidate?.priority_evidence);
  const priorPresence = context.prior_candidate_ids.has(candidate.candidate_id);
  const freshCurrentActionId = context.fresh_current_action_id ?? null;
  const supersededCurrentAction = candidate.source_kind === "current_action"
    && priorPresence
    && candidate.fresh !== true
    && freshCurrentActionId
    && freshCurrentActionId !== candidate.candidate_id;

  if (supersededCurrentAction) {
    return {
      candidate_id: candidate.candidate_id,
      source_kind: candidate.source_kind,
      prior_presence: true,
      fresh: false,
      gate_outcome: "clear",
      reason_codes: ["superseded_current_action"],
    };
  }

  const strongSupport = evidence.immediate_constraint_urgency > 0
    || evidence.expectation_violation === true;
  const supportedGoalTexts = array(candidate?.maintenance_evidence?.supported_goal_texts)
    .map((value) => currentMindText(value))
    .filter(Boolean);
  const currentGoalTexts = array(context.goal_texts)
    .map((value) => currentMindText(value))
    .filter(Boolean);
  const priorGoalContinuity = priorPresence
    && supportedGoalTexts.some((supportedGoal) => (
      currentGoalTexts.some((currentGoal) => (
        currentMindStableText(supportedGoal) === currentMindStableText(currentGoal)
      ))
    ));
  const maintenanceSupport = evidence.focus_continuity === true
    || evidence.goal_intention_relevance > 0
    || priorGoalContinuity;
  const freshAdmissionSupport = strongSupport
    || evidence.goal_intention_relevance > 0
    || evidence.perceptual_salience >= 2
    || candidate.source_kind === "current_action";

  if (priorPresence && maintenanceSupport) {
    return {
      candidate_id: candidate.candidate_id,
      source_kind: candidate.source_kind,
      prior_presence: true,
      fresh: candidate.fresh === true,
      gate_outcome: "maintain",
      reason_codes: [
        ...(evidence.focus_continuity === true ? ["focus_continuity"] : []),
        ...(
          evidence.goal_intention_relevance > 0 || priorGoalContinuity
            ? ["goal_or_intention_support"]
            : []
        ),
      ],
    };
  }

  if (candidate.fresh === true && freshAdmissionSupport) {
    return {
      candidate_id: candidate.candidate_id,
      source_kind: candidate.source_kind,
      prior_presence: priorPresence,
      fresh: true,
      gate_outcome: "admit",
      reason_codes: [
        ...(evidence.immediate_constraint_urgency > 0 ? ["immediate_constraint_or_urgency"] : []),
        ...(evidence.expectation_violation === true ? ["expectation_violation"] : []),
        ...(evidence.goal_intention_relevance > 0 ? ["goal_or_intention_support"] : []),
        ...(evidence.perceptual_salience >= 2 ? ["meaningful_perceptual_salience"] : []),
        ...(candidate.source_kind === "current_action" ? ["current_action"] : []),
      ],
    };
  }

  if (priorPresence) {
    return {
      candidate_id: candidate.candidate_id,
      source_kind: candidate.source_kind,
      prior_presence: true,
      fresh: candidate.fresh === true,
      gate_outcome: "decay",
      reason_codes: ["no_active_maintenance_support"],
    };
  }

  return {
    candidate_id: candidate.candidate_id,
    source_kind: candidate.source_kind,
    prior_presence: false,
    fresh: candidate.fresh === true,
    gate_outcome: "reject",
    reason_codes: ["insufficient_current_mind_support"],
  };
}

function currentMindOutputGateDecision(candidate, slot, admissionDecision = null) {
  if (!isObject(candidate)) return null;
  const evidence = object(candidate.priority_evidence);
  const admissionReasons = new Set(array(admissionDecision?.reason_codes));
  const reasonCodes = [];
  if (slot === "focus") reasonCodes.push("focus_selected");
  if (candidate.source_kind === "current_action") reasonCodes.push("current_action");
  if (evidence.immediate_constraint_urgency > 0) {
    reasonCodes.push("immediate_constraint_or_urgency");
  }
  if (evidence.expectation_violation === true) {
    reasonCodes.push("expectation_violation");
  }
  if (evidence.goal_intention_relevance > 0
    || admissionReasons.has("goal_or_intention_support")) {
    reasonCodes.push("goal_or_intention_support");
  }
  const open = reasonCodes.length > 0;
  return {
    candidate_id: candidate.candidate_id,
    source_kind: candidate.source_kind,
    slot,
    gate_outcome: open ? "open" : "closed",
    reason_codes: open ? [...new Set(reasonCodes)] : ["no_current_readout_support"],
  };
}

function currentMindOutputGateDecisions(state, prioritized, admissionDecisions) {
  const byId = new Map(
    array(prioritized)
      .filter(isObject)
      .map((candidate) => [candidate.candidate_id, candidate]),
  );
  const admissionById = new Map(
    array(admissionDecisions)
      .filter(isObject)
      .map((decision) => [decision.candidate_id, decision]),
  );
  const decisions = [];
  const addDecision = (candidate, slot) => {
    if (!isObject(candidate)) return;
    const evidenceCandidate = byId.get(candidate.candidate_id) ?? candidate;
    const decision = currentMindOutputGateDecision(
      evidenceCandidate,
      slot,
      admissionById.get(candidate.candidate_id) ?? null,
    );
    if (decision) decisions.push(decision);
  };
  addDecision(state?.focus, "focus");
  for (const [slot, values] of [
    ["active_context", state?.active_context],
    ["peripheral_context", state?.peripheral_context],
    ["fading_context", state?.fading_context],
    ["suspended_context", state?.suspended_context],
  ]) {
    for (const candidate of array(values)) addDecision(candidate, slot);
  }
  return decisions;
}

function currentMindCharacterReadout(state, decisions) {
  const gateByCandidateId = new Map(
    array(decisions).map((decision) => [decision.candidate_id, decision.gate_outcome]),
  );
  const isOpen = (candidate) => isObject(candidate)
    && gateByCandidateId.get(candidate.candidate_id) === "open";
  return {
    focus: isOpen(state?.focus) ? currentMindCharacterItem(state.focus) : null,
    active_context: array(state?.active_context)
      .filter(isOpen)
      .map(currentMindCharacterItem)
      .filter(Boolean),
    peripheral_context: array(state?.peripheral_context)
      .filter(isOpen)
      .map(currentMindCharacterItem)
      .filter(Boolean),
    fading_context: array(state?.fading_context)
      .filter(isOpen)
      .map(currentMindCharacterItem)
      .filter(Boolean),
    suspended_context: array(state?.suspended_context)
      .filter(isOpen)
      .map(currentMindCharacterItem)
      .filter(Boolean),
    temporary_expectation: sanitizeCurrentMindCharacterValue(
      state?.temporary_expectation ?? null,
    ),
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
  const experientialKnowledge = array(input.experiential_knowledge);
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
    const characterContext = isObject(memory)
      ? currentMindRecoveredMemoryCharacterContext(memory)
      : {};
    const recollectionOccurrenceHash = hashAgentRunValue({
      turn_id: input.turn_id ?? null,
      recovery_index: memoryIndex,
      content: sanitizeCurrentMindCharacterValue(content),
      character_context: characterContext,
    });
    addCandidate(currentMindCandidate({
      sourceKind: "recovered_memory",
      content,
      activationOrder,
      currentMindSequence,
      simulationTime,
      sourceRef: currentMindSourceRef("recovered_memory", content, {
        recovery_index: memoryIndex,
        recollection_occurrence_hash: recollectionOccurrenceHash,
      }),
      rawEvidence: isObject(memory) ? memory : {},
      characterContext,
    }));
  });

  experientialKnowledge.forEach((knowledge, knowledgeIndex) => {
    if (!isObject(knowledge)) return;
    const content = knowledge.content ?? knowledge;
    const reentryOccurrenceHash = hashAgentRunValue({
      turn_id: input.turn_id ?? null,
      reentry_index: knowledgeIndex,
      content: sanitizeCurrentMindCharacterValue(content),
    });
    addCandidate(currentMindCandidate({
      sourceKind: "experiential_knowledge",
      content,
      activationOrder,
      currentMindSequence,
      simulationTime,
      sourceRef: currentMindSourceRef("experiential_knowledge", content, {
        reentry_index: knowledgeIndex,
        reentry_occurrence_hash: reentryOccurrenceHash,
      }),
      rawEvidence: {
        goal_relevance: "medium",
        cue_retrieved: true,
      },
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
  const priorCandidateIds = new Set(
    priorCandidates.map((candidate) => candidate.candidate_id).filter(Boolean),
  );
  const prioritized = currentMindUniqueCandidates(candidates).map((candidate) => (
    currentMindPriorityEvidence(candidate, {
      current_focus_id: currentFocusId,
      goal_texts: goalTexts,
    })
  ));
  const freshCurrentActionId = prioritized.find(
    (candidate) => candidate.source_kind === "current_action" && candidate.fresh === true,
  )?.candidate_id ?? null;
  const admissionDecisions = prioritized.map((candidate) => (
    currentMindAdmissionDecision(candidate, {
      prior_candidate_ids: priorCandidateIds,
      fresh_current_action_id: freshCurrentActionId,
      goal_texts: goalTexts,
    })
  ));
  const admissionByCandidateId = new Map(
    admissionDecisions.map((decision) => [decision.candidate_id, decision]),
  );
  const competitionCandidates = prioritized.filter((candidate) => {
    const outcome = admissionByCandidateId.get(candidate.candidate_id)?.gate_outcome;
    return outcome === "admit" || outcome === "maintain";
  });
  const currentFocusCandidate = currentFocusId
    ? competitionCandidates.find((candidate) => candidate.candidate_id === currentFocusId) ?? null
    : null;
  let strongestChallenger = null;
  for (const candidate of competitionCandidates) {
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
    const gateOutcome = admissionByCandidateId.get(candidate.candidate_id)?.gate_outcome ?? "reject";
    if (gateOutcome === "reject" || gateOutcome === "clear") continue;
    if (priorSuspendedIds.has(candidate.candidate_id) && candidate.fresh !== true) continue;
    const evidence = candidate.priority_evidence;
    const decay = currentMindDecayMetadata(candidate, currentMindSequence, simulationTime);
    const stronglyActive = evidence.immediate_constraint_urgency > 0
      || evidence.expectation_violation
      || evidence.goal_intention_relevance > 0
      || evidence.perceptual_salience >= 2;
    const competitionEligible = gateOutcome === "admit" || gateOutcome === "maintain";
    if (competitionEligible && stronglyActive && activeContext.length < activeBudget) {
      activeContext.push(candidate);
      continue;
    }
    if (competitionEligible && peripheralContext.length < peripheralBudget) {
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
    if (admissionByCandidateId.get(priorSuspended.candidate_id)?.gate_outcome === "clear") continue;
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
  const outputGateDecisions = currentMindOutputGateDecisions(
    stateAfter,
    prioritized,
    admissionDecisions,
  );
  const characterReadout = currentMindCharacterReadout(
    stateAfter,
    outputGateDecisions,
  );
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
      processing_level: processingByCandidateId.get(candidate.candidate_id) ?? "not_admitted",
      current_mind_gate_outcome:
        admissionByCandidateId.get(candidate.candidate_id)?.gate_outcome ?? "reject",
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
    experiential_knowledge: sanitizeCurrentMindValue(experientialKnowledge),
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
    admission_decisions: cloneJson(admissionDecisions),
    output_gate_version: worldSimulationCharacterWorkingMemoryOutputGateVersion,
    output_gate_decisions: cloneJson(outputGateDecisions),
    focus_transition: focusTransition,
    context_transition: {
      admitted_count: admissionDecisions.filter((decision) => decision.gate_outcome === "admit").length,
      maintained_count: admissionDecisions.filter((decision) => decision.gate_outcome === "maintain").length,
      rejected_count: admissionDecisions.filter((decision) => decision.gate_outcome === "reject").length,
      cleared_count: admissionDecisions.filter((decision) => decision.gate_outcome === "clear").length,
      decaying_count: admissionDecisions.filter((decision) => decision.gate_outcome === "decay").length,
      output_open_count: outputGateDecisions.filter((decision) => decision.gate_outcome === "open").length,
      output_closed_count: outputGateDecisions.filter((decision) => decision.gate_outcome === "closed").length,
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
      selective_input_gating_installed: true,
      input_gate_closed_by_default: true,
      gate_outcomes: ["admit", "maintain", "reject", "clear", "decay"],
      admission_hysteresis: "fresh_entry_requires_more_support_than_prior_maintenance",
      output_gating_installed: true,
      output_gate_version: worldSimulationCharacterWorkingMemoryOutputGateVersion,
      output_gate_outcomes: ["open", "closed"],
      output_gate_changes_current_mind_state: false,
      output_gate_uses_learned_policy: false,
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
      selective_current_mind_input_gating_installed: true,
      rejected_perception_means_not_admitted_not_unperceived: true,
      current_mind_clear_does_not_mutate_source_memory: true,
      output_gating_installed: true,
      output_gate_version: worldSimulationCharacterWorkingMemoryOutputGateVersion,
      output_gate_closed_representation_remains_in_current_mind: true,
      output_gate_does_not_mutate_source_memory: true,
      output_gate_does_not_change_current_mind_placement: true,
      attention_focus_directly_controls_memory_encoding: false,
    },
  };
  projectionBody.transition_hash = hashAgentRunValue(projectionBody);

  return {
    projection: cloneJson(projectionBody),
    character_facing_attention: cloneJson(characterReadout),
    working_context: cloneJson({
      focus: characterReadout.focus,
      active_context: characterReadout.active_context,
      peripheral_context: characterReadout.peripheral_context,
      fading_context: characterReadout.fading_context,
      suspended_context: characterReadout.suspended_context,
    }),
    encoding_evidence: cloneJson(encodingEvidence),
    internal_attention_state: {
      admission_decisions: cloneJson(admissionDecisions),
      output_gate_decisions: cloneJson(outputGateDecisions),
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

function boundedPostOutcomeSubjectiveExperience(
  projection,
  character,
  selectedActionId,
) {
  const source = object(projection);
  if (source.version !== worldSimulationPostOutcomeSubjectivePerceptionVersion) return null;
  const projectionHash = typeof source.projection_hash === "string"
    ? source.projection_hash.trim()
    : "";
  if (!projectionHash) return null;
  const body = cloneJson(source);
  delete body.projection_hash;
  if (hashAgentRunValue(body) !== projectionHash) {
    const error = new Error(
      "Post-outcome subjective perception projection hash verification failed.",
    );
    error.code = "WORLD_SIMULATION_POST_OUTCOME_SUBJECTIVE_PERCEPTION_HASH_MISMATCH";
    throw error;
  }
  const matches = array(source.character_experiences).filter((entry) => (
    sameCharacterName(entry?.character, character)
    && String(entry?.action_id ?? "") === String(selectedActionId ?? "")
  ));
  if (matches.length > 1) {
    const error = new Error(
      `Post-outcome subjective perception contains duplicate action experience for ${character}.`,
    );
    error.code = "WORLD_SIMULATION_POST_OUTCOME_SUBJECTIVE_PERCEPTION_DUPLICATE_ACTION";
    throw error;
  }
  const experience = object(matches[0]?.experience);
  const projected = { action_id: selectedActionId ?? null };
  for (const key of ["performed", "perceived_result", "perceived_status"]) {
    if (!Object.hasOwn(experience, key)) continue;
    const value = safeCharacterOutcomeScalar(experience[key]);
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
  const postOutcomeSubjectivePerception = object(
    input.post_outcome_subjective_perception_projection,
  );
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
    const projectedPostOutcomeExperience = participated
      ? boundedPostOutcomeSubjectiveExperience(
          postOutcomeSubjectivePerception,
          character,
          ownSelection.action_id ?? null,
        )
      : null;
    const ownActionOutcomes = participated
      ? projectedPostOutcomeExperience
        ? [projectedPostOutcomeExperience]
        : actionOutcomes
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
      selective_working_memory_input_gating_v4_installed: true,
      input_gate_closed_by_default: true,
      gate_outcomes: ["admit", "maintain", "reject", "clear", "decay"],
      rejected_perception_remains_bounded_perception: true,
      prior_supported_context_may_be_maintained_without_refresh: true,
      clear_is_current_mind_representation_removal_not_forgetting: true,
      selective_working_memory_output_gating_v5_installed: true,
      output_gating_installed: true,
      output_gate_version: worldSimulationCharacterWorkingMemoryOutputGateVersion,
      output_gate_outcomes: ["open", "closed"],
      output_gate_changes_current_mind_state: false,
      output_gate_closed_representation_remains_maintained: true,
      output_gate_reason_codes_exposed_to_character_brain: false,
      recollection_reinstatement_v3_installed: true,
      recollection_context_origin: "recovered_memory",
      recollection_safe_epistemic_metadata_preserved: true,
      recollection_engine_provenance_exposed_to_character_brain: false,
      recollection_single_semantic_exposure_enforced: true,
      final_character_brain_recollection_channel: "cognition.working_context",
      raw_recovered_memories_forwarded_at_final_brain_ingress: false,
      same_memory_later_retrieval_occurrence_allowed: true,
      recollection_attention_mutates_source_memory: false,
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
    visible_constraint_observation_bridge:
      buildWorldSimulationVisibleConstraintObservationContract(),
    subjective_means_feasibility_reconsideration:
      buildWorldSimulationSubjectiveMeansFeasibilityReconsiderationContract(),
    subjective_memory_formation: buildWorldSimulationSubjectiveMemoryFormationContract(),
    subjective_episode_segmentation:
      buildWorldSimulationSubjectiveEpisodeSegmentationContract(),
    autobiographical_life_event_organization:
      buildWorldSimulationAutobiographicalLifeEventOrganizationContract(),
    personal_semantic_memory:
      buildWorldSimulationPersonalSemanticMemoryContract(),
    autobiographical_life_period_organization:
      buildWorldSimulationAutobiographicalLifePeriodContract(),
    autobiographical_summary_read_projection:
      buildWorldSimulationAutobiographicalSummaryProjectionContract(),
    autobiographical_self_interpretation:
      buildWorldSimulationAutobiographicalSelfInterpretationContract(),
    structured_self_model:
      buildWorldSimulationStructuredSelfModelContract(),
    structured_self_model_revision:
      buildWorldSimulationStructuredSelfModelRevisionContract(),
    implementation_intention_activation_guidance:
      buildWorldSimulationGoalImplementationIntentionActivationContract(),
    implementation_intention_execution_feedback:
      buildWorldSimulationGoalImplementationIntentionExecutionFeedbackContract(),
    goal_achievement_verification:
      buildWorldSimulationGoalAchievementVerificationContract(),
    goal_viability_unattainability:
      buildWorldSimulationGoalViabilityUnattainabilityContract(),
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
    subjective_memory_plasticity:
      buildWorldSimulationMemoryPlasticityContract(),
    subjective_claim_projection:
      buildWorldSimulationSubjectiveClaimProjectionContract(),
    subjective_claim_conflict_revision_projection:
      buildWorldSimulationSubjectiveClaimConflictRevisionContract(),
    subjective_belief_resolution:
      buildWorldSimulationSubjectiveBeliefResolutionContract(),
    subjective_belief_revision:
      buildWorldSimulationSubjectiveBeliefRevisionContract(),
    subjective_cognition_read_projection:
      buildWorldSimulationSubjectiveCognitionProjectionContract(),
    subjective_belief_character_projection:
      buildWorldSimulationSubjectiveBeliefCharacterProjectionContract(),
    subjective_choice_commitment_receipt:
      buildWorldSimulationSubjectiveChoiceCommitmentReceiptContract(),
    experiential_method_competition:
      buildWorldSimulationExperientialMethodCompetitionContract(),
    experiential_method_competition_resolution:
      buildWorldSimulationExperientialMethodCompetitionResolutionContract(),
    experiential_method_competition_guidance:
      buildWorldSimulationExperientialMethodCompetitionGuidanceContract(),
    experiential_method_impasse_deliberation:
      buildWorldSimulationExperientialMethodImpasseDeliberationContract(),
    experiential_method_impasse_discriminating_evidence:
      buildWorldSimulationExperientialMethodImpasseDiscriminatingEvidenceContract(),
    experiential_method_impasse_reresolution:
      buildWorldSimulationExperientialMethodImpasseReresolutionContract(),
    experiential_method_impasse_resolution_application_lineage:
      buildWorldSimulationExperientialMethodImpasseResolutionApplicationLineageContract(),
    experiential_method_impasse_resolution_outcome_evidence:
      buildWorldSimulationExperientialMethodImpasseResolutionOutcomeEvidenceContract(),
    experiential_method_impasse_precedent_reentry:
      buildWorldSimulationExperientialMethodImpassePrecedentReentryContract(),
    experiential_method_impasse_precedent_reresolution:
      buildWorldSimulationExperientialMethodImpassePrecedentReresolutionContract(),
    experiential_method_application_lineage:
      buildWorldSimulationExperientialMethodApplicationLineageContract(),
    experiential_method_outcome_credit:
      buildWorldSimulationExperientialMethodOutcomeCreditContract(),

    experiential_method_competition_resolver_hook: {
      owner: "programmatic_experiential_method_competition_resolver",
      optional: true,
      option_name: "experientialMethodCompetitionResolver",
      source_scope: "same_turn_verified_phase79a_competition_plus_exact_phase76e_methods",
      receives_competition_refs: true,
      receives_bounded_method_skeletons: true,
      receives_current_cue_grounding: true,
      receives_selected_action: false,
      receives_action_outcome: false,
      receives_world_state: false,
      receives_hidden_causal_evidence: false,
      may_return_only_competition_ref_preference_pairs: true,
      supported_preferences: ["left_preferred", "right_preferred", "indifferent", "unresolved"],
      action_selection_authority: false,
      semantic_revision_authority: false,
      numeric_utility_authority: false,
      missing_hook_preserves_competition_as_impasse: true,
    },

    experiential_method_impasse_reresolution_resolver_hook: {
      owner: "programmatic_experiential_method_impasse_reresolution_resolver",
      optional: true,
      option_name: "experientialMethodImpasseReresolutionResolver",
      source_scope: "same_turn_verified_phase79d_impasse_plus_phase79e_bounded_discriminating_evidence",
      receives_existing_impasse_competition_refs: true,
      receives_bounded_retained_method_skeletons: true,
      receives_phase79e_cue_refs_and_content: true,
      receives_original_phase79b_engine_resolver_view: false,
      receives_selected_action: false,
      receives_action_outcome: false,
      receives_world_state: false,
      receives_hidden_causal_evidence: false,
      may_return_only_impasse_ref_competition_ref_preference_evidence_ref_records: true,
      supported_preferences: ["left_preferred", "right_preferred", "indifferent"],
      evidence_cue_ref_required: true,
      action_selection_authority: false,
      semantic_revision_authority: false,
      numeric_utility_authority: false,
      missing_hook_preserves_impasse: true,
    },

    experiential_method_impasse_precedent_reresolution_resolver_hook: {
      owner: "programmatic_experiential_method_impasse_precedent_reresolution_resolver",
      optional: true,
      option_name: "experientialMethodImpassePrecedentReresolutionResolver",
      source_scope: "phase79f_remaining_impasses_plus_phase79i_exact_full_cue_match_precedents",
      receives_existing_impasse_competition_refs: true,
      receives_bounded_current_method_skeletons: true,
      receives_exact_match_precedent_refs: true,
      receives_precedent_outcome_assessment: true,
      receives_raw_world_history: false,
      receives_historical_transfer_refs_as_current_identity: false,
      receives_selected_action: false,
      receives_current_action_outcome: false,
      receives_world_state: false,
      receives_hidden_causal_evidence: false,
      may_return_only_impasse_ref_competition_ref_preference_precedent_ref_records: true,
      supported_preferences: ["left_preferred", "right_preferred", "indifferent"],
      nonempty_eligible_precedent_refs_required: true,
      directional_preference_requires_directionally_relevant_nonambiguous_precedent: true,
      automatic_majority_or_recency_voting_allowed: false,
      fuzzy_similarity_allowed: false,
      action_selection_authority: false,
      semantic_revision_authority: false,
      numeric_utility_authority: false,
      comparative_truth_authority: false,
      missing_hook_preserves_phase79f_impasse: true,
    },

    experiential_method_candidate_attribution_resolver_hook: {
      owner: "programmatic_experiential_method_candidate_attribution_resolver",
      optional: true,
      option_name: "experientialMethodCandidateAttributionResolver",
      source_scope:
        "same_turn_verified_phase76e_transfer_plus_existing_action_proposer_candidates",
      receives_phase76e_transfer_refs: true,
      receives_bounded_phase76e_method_skeletons: true,
      receives_phase74a_action_refs: true,
      receives_bounded_action_candidate_semantics: true,
      receives_selected_action: false,
      receives_action_outcome: false,
      receives_world_state: false,
      receives_raw_world_event: false,
      receives_hidden_causal_evidence: false,
      may_return_only_transfer_ref_action_ref_pairs: true,
      many_to_many_attribution_allowed: true,
      may_author_method_content: false,
      may_author_action_content: false,
      action_selection_authority: false,
      causal_credit_authority: false,
      success_failure_learning_authority: false,
      retain_revise_authority: false,
      may_assert_world_truth: false,
      may_assert_confidence_probability_similarity_utility: false,
      missing_hook_means_no_candidate_attribution: true,
    },

    experiential_method_outcome_credit_resolver_hook: {
      owner: "programmatic_experiential_method_outcome_credit_resolver",
      optional: true,
      option_name: "experientialMethodOutcomeCreditResolver",
      source_scope:
        "same_turn_phase76f_selected_application_plus_bounded_phase76b_subjective_outcome_and_verified_autobiographical_lineage",
      receives_selected_phase76f_application_ref: true,
      receives_bounded_method_skeleton: true,
      receives_bounded_subjective_experience: true,
      receives_raw_action_outcome: false,
      receives_hidden_causal_evidence: false,
      receives_world_state: false,
      receives_source_semantic_identity: false,
      receives_life_event_identity: false,
      may_return_only_application_ref_assessment_pairs: true,
      supported_assessments: [
        "supports_prior_method",
        "counterevidence_for_prior_method",
        "ambiguous_no_revision",
      ],
      single_method_required_for_support_or_counterevidence: true,
      performed_required_for_support_or_counterevidence: true,
      exact_current_life_event_required_for_semantic_revision: true,
      causal_credit_authority: false,
      numeric_reward_q_value_authority: false,
      semantic_memory_write_authority: false,
      durable_semantic_revision_owner: "Phase67C",
      direct_belief_plan_goal_current_mind_world_mutation_authority: false,
      missing_hook_means_no_outcome_credit_assessment: true,
    },

    autobiographical_life_event_organization_resolver_hook: {
      owner:
        "programmatic_autobiographical_life_event_organization_resolver",
      optional:
        true,
      option_name:
        "autobiographicalLifeEventOrganizationResolver",
      source_scope:
        "current_turn_phase67a_subjective_episode_updates_only",
      receives_world_state:
        false,
      receives_raw_world_event:
        false,
      receives_memory_content:
        false,
      receives_episode_content:
        false,
      receives_phase67a_source_event_hashes:
        true,
      may_request_decisions: [
        "start_new_life_event",
        "attach_to_open_life_event",
      ],
      cross_episode_attach_requires_strong_materialized_evidence:
        true,
      supported_strong_evidence_kinds: [
        "explicit_programmatic_binding",
      ],
      explicit_programmatic_binding_provenance_pinned_to_resolver_view_hash:
        true,
      unverifiable_goal_task_project_relationship_evidence_accepted:
        false,
      temporal_contiguity_alone_is_sufficient:
        false,
      spatial_contiguity_alone_is_sufficient:
        false,
      freeform_llm_semantic_merge_authority:
        false,
      missing_hook_defaults_new_episode_to_new_life_event:
        true,
      may_assert_world_truth:
        false,
      may_assert_confidence_probability:
        false,
      may_rewrite_subjective_episode:
        false,
      character_brain_direct_life_event_mutation_allowed:
        false,
    },

    personal_semantic_memory_resolver_hook: {
      owner:
        "programmatic_personal_semantic_memory_resolver",
      optional:
        true,
      option_name:
        "personalSemanticMemoryResolver",
      source_scope:
        "current_turn_phase67b_trigger_plus_same_character_life_event_evidence",
      current_turn_life_event_trigger_required:
        true,
      receives_world_state:
        false,
      receives_raw_world_event:
        false,
      receives_memory_content:
        false,
      receives_episode_content:
        false,
      receives_life_event_content:
        false,
      receives_structural_life_event_provenance:
        true,
      may_request_operations: [
        "form",
        "support",
        "counterevidence",
      ],
      supported_categories: [
        "recurring_event_pattern",
        "autobiographical_fact",
      ],
      semanticization_requires_explicit_programmatic_decision:
        true,
      eager_semanticization:
        false,
      recurring_event_pattern_auto_promoted_by_count:
        false,
      trait_inference_allowed:
        false,
      role_identity_inference_allowed:
        false,
      value_inference_allowed:
        false,
      preference_inference_allowed:
        false,
      self_model_inference_allowed:
        false,
      epistemic_acceptance_authority:
        false,
      counterevidence_may_revise_belief:
        false,
      missing_hook_means_no_semanticization:
        true,
      may_assert_world_truth:
        false,
      may_assert_confidence_probability:
        false,
      character_brain_direct_personal_semantic_mutation_allowed:
        false,
    },

    autobiographical_life_period_organization_resolver_hook: {
      owner:
        "programmatic_autobiographical_life_period_organization_resolver",
      optional:
        true,
      option_name:
        "autobiographicalLifePeriodOrganizationResolver",
      source_scope:
        "current_turn_phase67b_phase67c_triggers_plus_same_character_autobiographical_evidence",
      current_turn_autobiographical_trigger_required:
        true,
      receives_world_state:
        false,
      receives_raw_world_event:
        false,
      receives_memory_content:
        false,
      receives_life_event_content:
        false,
      receives_structural_life_event_provenance:
        true,
      receives_materialized_personal_semantic_evidence:
        true,
      may_request_operations: [
        "start_period",
        "attach_life_event",
        "close_period",
      ],
      supported_evidence_kinds: [
        "explicit_programmatic_binding",
        "personal_semantic_support",
      ],
      overlapping_periods_allowed:
        true,
      many_to_many_life_event_membership:
        true,
      one_primary_period_parent_per_life_event:
        false,
      temporal_adjacency_alone_is_sufficient:
        false,
      calendar_bucket_is_sufficient:
        false,
      fixed_duration_threshold_modeled:
        false,
      cultural_life_script_assumption_allowed:
        false,
      freeform_llm_period_authority:
        false,
      missing_hook_means_no_period_organization:
        true,
      may_assert_world_truth:
        false,
      may_assert_confidence_probability:
        false,
      self_model_inference_allowed:
        false,
      belief_revision_authority:
        false,
      character_brain_direct_life_period_mutation_allowed:
        false,
    },

    autobiographical_self_interpretation_resolver_hook: {
      owner:
        "programmatic_autobiographical_self_interpretation_resolver",
      optional:
        true,
      option_name:
        "autobiographicalSelfInterpretationResolver",
      source_scope:
        "current_turn_phase67_trigger_plus_same_character_autobiographical_history",
      current_turn_phase67_trigger_required:
        true,
      receives_world_state:
        false,
      receives_raw_world_event:
        false,
      receives_memory_content:
        false,
      receives_hidden_retrieval_graph:
        false,
      receives_structural_phase67_provenance:
        true,
      may_request_operations: [
        "establish",
        "supersede",
      ],
      supported_interpretation_kinds: [
        "continuity",
        "change",
        "causal_connection",
        "thematic_recurrence",
        "contrast",
      ],
      explicit_supersession_only:
        true,
      multiple_active_interpretations_allowed:
        true,
      max_one_durable_event_per_character_per_turn:
        true,
      last_write_wins_allowed:
        false,
      mandatory_narrative_coherence_required:
        false,
      freeform_life_story_authority:
        false,
      may_assert_world_truth:
        false,
      may_assert_confidence_probability:
        false,
      belief_resolution_authority:
        false,
      trait_inference_allowed:
        false,
      value_inference_allowed:
        false,
      preference_inference_allowed:
        false,
      role_identity_inference_allowed:
        false,
      capability_self_rating_allowed:
        false,
      motivation_goal_inference_allowed:
        false,
      self_model_inference_allowed:
        false,
      character_brain_direct_self_interpretation_mutation_allowed:
        false,
      missing_hook_means_no_new_interpretation:
        true,
    },

    structured_self_model_resolver_hook: {
      owner: "programmatic_structured_self_model_resolver",
      optional: true,
      option_name: "structuredSelfModelResolver",
      source_scope: "current_turn_phase68a_interpretation_plus_same_character_interpretation_history",
      current_turn_phase68a_trigger_required: true,
      receives_world_state: false,
      receives_raw_world_event: false,
      receives_raw_memory_content: false,
      receives_phase67_store: false,
      receives_hidden_retrieval_graph: false,
      may_request_operations: ["form"],
      supported_aspect_types: [
        "trait_tendency",
        "value_orientation",
        "preference",
        "role_identity",
        "capability_appraisal",
      ],
      formation_only: true,
      revision_authority: false,
      max_one_durable_event_per_character_per_turn: true,
      last_write_wins_allowed: false,
      forced_cross_domain_consistency_required: false,
      may_assert_world_truth: false,
      may_assert_self_model_accuracy: false,
      may_assert_self_model_clarity: false,
      may_assert_confidence_probability: false,
      may_assert_numeric_personality_or_capability_score: false,
      motivation_goal_selection_authority: false,
      character_brain_direct_self_model_mutation_allowed: false,
      missing_hook_means_no_new_aspect: true,
    },

    structured_self_model_revision_resolver_hook: {
      owner: "programmatic_structured_self_model_revision_resolver",
      optional: true,
      option_name: "structuredSelfModelRevisionResolver",
      source_scope: "current_turn_phase68a_or_phase68b_trigger_plus_active_same_character_self_model",
      current_turn_phase68a_or_phase68b_trigger_required: true,
      receives_world_state: false,
      receives_raw_world_event: false,
      receives_raw_memory_content: false,
      receives_phase67_store: false,
      receives_hidden_retrieval_graph: false,
      may_request_operations: ["support", "challenge", "revise"],
      explicit_target_aspect_ids_required: true,
      support_preserves_active_state: true,
      challenge_preserves_active_state: true,
      revise_supersedes_named_active_targets_only: true,
      replacement_receives_new_deterministic_identity: true,
      unresolved_challenges_may_coexist: true,
      max_one_durable_event_per_character_per_turn: true,
      last_write_wins_allowed: false,
      forced_global_coherence_required: false,
      neighboring_aspect_auto_propagation_allowed: false,
      may_assert_world_truth: false,
      may_assert_self_model_accuracy: false,
      may_assert_self_model_clarity: false,
      may_assert_confidence_probability: false,
      motivation_goal_selection_authority: false,
      character_brain_direct_self_model_revision_allowed: false,
      missing_hook_means_no_new_revision: true,
    },

    subjective_claim_resolver_hook: {
      owner:
        "programmatic_subjective_claim_resolver",
      optional:
        true,
      option_name:
        "subjectiveClaimResolver",
      source_scope:
        "current_turn_new_subjective_memories_only",
      receives_world_state:
        false,
      receives_raw_world_event:
        false,
      receives_whole_persistent_memory_store:
        false,
      receives_retrieval_history:
        false,
      receives_memory_plasticity_history:
        false,
      receives_internal_memory_provenance:
        false,
      may_propose_claim_text:
        true,
      may_assert_world_truth:
        false,
      may_assert_confidence_probability:
        false,
      may_rewrite_memory:
        false,
      character_brain_direct_claim_mutation_allowed:
        false,
      missing_hook_means_no_new_claims:
        true,
    },

    subjective_claim_relation_resolver_hook: {
      owner:
        "programmatic_subjective_claim_relation_resolver",
      optional:
        true,
      option_name:
        "subjectiveClaimRelationResolver",
      source_scope:
        "current_turn_claims_plus_same_character_prior_claims",
      receives_world_state:
        false,
      receives_raw_world_event:
        false,
      receives_memory_content:
        false,
      receives_retrieval_history:
        false,
      receives_memory_plasticity_history:
        false,
      may_propose_relations: [
        "challenges",
        "supersedes",
      ],
      source_claim_must_be_current_turn:
        true,
      same_turn_supersession_allowed:
        false,
      may_assert_world_truth:
        false,
      may_assert_confidence_probability:
        false,
      may_invalidate_or_rewrite_target_claim:
        false,
      character_brain_direct_relation_mutation_allowed:
        false,
      missing_hook_means_no_new_relations:
        true,
    },

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
  const worldHistory = await getWorldSimulationHistory(sessionId, options);
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
  const subjectiveCognitionProjections = [];
  const subjectiveBeliefCharacterProjections = [];
  const experientialKnowledgeReentryProjections = [];
  const experientialMethodTransferProjections = [];
  const experientialMethodCompetitionProjections = [];
  const experientialMethodCompetitionResolutionProjections = [];
  const experientialMethodCompetitionGuidanceProjections = [];
  const experientialMethodImpasseDeliberationProjections = [];
  const experientialMethodImpasseDiscriminatingEvidenceProjections = [];
  const experientialMethodImpasseReresolutionProjections = [];
  const experientialMethodImpassePrecedentReentryProjections = [];
  const experientialMethodImpassePrecedentReresolutionProjections = [];
  const experientialMethodCandidateAttributionProjections = [];
  const autobiographicalSummaryCharacterProjections = [];
  const autobiographicalSelfInterpretationCharacterProjections = [];
  const structuredSelfModelCharacterProjections = [];
  const revisedStructuredSelfModelCharacterProjections = [];
  const visibleConstraintObservationProjections = [];
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

    // Phase73A projects only already-committed Phase72 evidence that was
    // explicitly marked character-visible. Receipts are available for exactly
    // the next committed state revision, so no Phase72 result can feed back
    // into the same turn that produced it. The projection contributes only a
    // bounded observation; subjective interpretation remains owned by the
    // existing perception -> memory -> claim/belief pipeline.
    const visibleConstraintObservationProjection =
      projectWorldSimulationVisibleConstraintObservationsForCharacter({
        world_state: worldState,
        character,
        state_revision: snapshot.revision,
      });
    characterPerception.other_senses = [
      ...array(characterPerception.other_senses),
      ...array(visibleConstraintObservationProjection.character_view.other_senses),
    ];
    visibleConstraintObservationProjections.push({
      character,
      version: visibleConstraintObservationProjection.version,
      character_view_hash:
        visibleConstraintObservationProjection.character_view_hash,
      observation_content_hashes: [
        ...new Set(
          array(visibleConstraintObservationProjection.character_view.other_senses)
            .map((observation) => hashAgentRunValue(observation)),
        ),
      ].sort(),
      audit: cloneJson(visibleConstraintObservationProjection.audit),
    });

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

    // Phase76D re-enters only already committed, same-character Phase67C
    // personal semantic knowledge. The resolver sees bounded current cues plus
    // an opaque canonical candidate catalog and may only select refs; it cannot
    // author remembered content or choose an action. Selected knowledge still
    // has to pass the ordinary Current Mind admission/output gates below.
    const experientialKnowledgeReentryResolverView =
      buildWorldSimulationExperientialKnowledgeReentryResolverView({
        world_state: worldState,
        character,
        current_turn_id: turnId,
        current_context: {
          perception: characterPerception,
          recovered_memories: recoveredMemories,
          current_action: characterState.current_action ?? null,
          goals: characterState.goals ?? [],
          current_goals: characterState.current_goals ?? [],
          current_goal: characterState.current_goal ?? null,
        },
      });
    const experientialKnowledgeReentryResolver =
      typeof options.experientialKnowledgeReentryResolver === "function"
        ? options.experientialKnowledgeReentryResolver
        : null;
    const rawActivatedExperientialKnowledgeRefs =
      experientialKnowledgeReentryResolver
        ? await experientialKnowledgeReentryResolver(
          cloneJson(experientialKnowledgeReentryResolverView),
        )
        : [];
    if (!Array.isArray(rawActivatedExperientialKnowledgeRefs)) {
      const error = new Error(
        "experientialKnowledgeReentryResolver must return an array of opaque personal semantic refs.",
      );
      error.code =
        "WORLD_SIMULATION_EXPERIENTIAL_KNOWLEDGE_REENTRY_RESOLVER_INVALID_OUTPUT";
      throw error;
    }
    const experientialKnowledgeReentry =
      projectWorldSimulationExperientialKnowledgeReentry({
        resolver_view: experientialKnowledgeReentryResolverView,
        activated_semantic_refs: rawActivatedExperientialKnowledgeRefs,
      });
    // Keep the full canonical engine-side projection so later post-outcome
    // provenance can re-verify the exact Phase76D hash. Character-facing
    // consumers still receive only character_view through the bounded cognition
    // path; this prepared-turn copy is not a new character disclosure surface.
    experientialKnowledgeReentryProjections.push(
      cloneJson(experientialKnowledgeReentry),
    );

    // Phase76E performs bounded analogical transfer over methods that Phase76D
    // already recalled. It maps relational method skeletons to canonical
    // current-context cue refs only; it cannot author a concrete action, plan,
    // belief, or world mutation. The resulting guidance is attached to the
    // character cognition below, where the existing Action Proposer and Phase74
    // deliberation remain responsible for adapting it to current choices.
    const experientialMethodTransferResolverView =
      buildWorldSimulationExperientialMethodTransferResolverView({
        character,
        current_turn_id: turnId,
        experiential_knowledge_reentry: experientialKnowledgeReentry,
        current_context: {
          perception: characterPerception,
          current_action: characterState.current_action ?? null,
          goals: characterState.goals ?? [],
          current_goals: characterState.current_goals ?? [],
          current_goal: characterState.current_goal ?? null,
        },
      });
    const experientialMethodTransferResolver =
      typeof options.experientialMethodTransferResolver === "function"
        ? options.experientialMethodTransferResolver
        : null;
    const rawExperientialMethodTransferMappings = experientialMethodTransferResolver
      ? await experientialMethodTransferResolver(
        cloneJson(experientialMethodTransferResolverView),
      )
      : [];
    if (!Array.isArray(rawExperientialMethodTransferMappings)) {
      const error = new Error(
        "experientialMethodTransferResolver must return an array of canonical transfer mappings.",
      );
      error.code =
        "WORLD_SIMULATION_EXPERIENTIAL_METHOD_TRANSFER_RESOLVER_INVALID_OUTPUT";
      throw error;
    }
    const experientialMethodTransfer =
      projectWorldSimulationExperientialMethodTransfer({
        resolver_view: experientialMethodTransferResolverView,
        transfer_mappings: rawExperientialMethodTransferMappings,
      });
    // Phase76G later needs exact Phase76D→76E provenance verification after
    // the action result exists. Preserve the full canonical engine-side
    // transfer projection here without changing its bounded character view.
    experientialMethodTransferProjections.push(
      cloneJson(experientialMethodTransfer),
    );

    // Phase79A/79B/79C resolves competition among multiple transferred methods
    // without becoming an action selector. Phase79A identifies same-cue
    // structural competition, Phase79B accepts qualitative preferences only,
    // and Phase79C narrows guidance only when a dominant method is actually
    // established. Tie/conflict impasses remain explicit and all implicated
    // methods stay available for the existing Phase74/75 deliberation path.
    const experientialMethodCompetition =
      projectWorldSimulationExperientialMethodCompetition({
        experiential_method_transfer_projections: [experientialMethodTransfer],
        current_turn_id: turnId,
        character,
      });
    experientialMethodCompetitionProjections.push(
      cloneJson(experientialMethodCompetition),
    );
    const experientialMethodCompetitionResolutionResolverView =
      buildWorldSimulationExperientialMethodCompetitionResolutionResolverView({
        experiential_method_competition: experientialMethodCompetition,
        experiential_method_transfer_projections: [experientialMethodTransfer],
      });
    const experientialMethodCompetitionResolver =
      typeof options.experientialMethodCompetitionResolver === "function"
        ? options.experientialMethodCompetitionResolver
        : null;
    const rawExperientialMethodCompetitionPreferences =
      experientialMethodCompetitionResolver
        ? await experientialMethodCompetitionResolver(
          cloneJson(experientialMethodCompetitionResolutionResolverView),
        )
        : [];
    if (!Array.isArray(rawExperientialMethodCompetitionPreferences)) {
      const error = new Error(
        "experientialMethodCompetitionResolver must return an array of competition_ref/preference decisions.",
      );
      error.code =
        "WORLD_SIMULATION_EXPERIENTIAL_METHOD_COMPETITION_RESOLVER_INVALID_OUTPUT";
      throw error;
    }
    const experientialMethodCompetitionResolution =
      projectWorldSimulationExperientialMethodCompetitionResolution({
        resolver_view: experientialMethodCompetitionResolutionResolverView,
        preference_decisions: rawExperientialMethodCompetitionPreferences,
      });
    experientialMethodCompetitionResolutionProjections.push(
      cloneJson(experientialMethodCompetitionResolution),
    );
    const experientialMethodCompetitionGuidance =
      projectWorldSimulationExperientialMethodCompetitionGuidance({
        experiential_method_transfer: experientialMethodTransfer,
        experiential_method_competition_resolution:
          experientialMethodCompetitionResolution,
      });
    experientialMethodCompetitionGuidanceProjections.push(
      cloneJson(experientialMethodCompetitionGuidance),
    );
    // Phase79D materializes only bounded tie/conflict impasse substates from
    // the exact Phase79B/79C lineage. It does not author a new preference or
    // select an action; it exposes the retained methods and already-bounded
    // current-context basis so downstream deliberation can seek discriminating
    // evidence without arbitrary tie-breaking.
    const experientialMethodImpasseDeliberation =
      projectWorldSimulationExperientialMethodImpasseDeliberation({
        experiential_method_competition_resolution:
          experientialMethodCompetitionResolution,
        experiential_method_competition_guidance:
          experientialMethodCompetitionGuidance,
      });
    experientialMethodImpasseDeliberationProjections.push(
      cloneJson(experientialMethodImpasseDeliberation),
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
          experiential_knowledge:
            experientialKnowledgeReentry.character_view.experiential_knowledge,
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

    // Phase65C is a read-only bridge from already committed prior-turn
    // subjective claims into practical cognition. Building the projection
    // here guarantees that claims created later in resolveWorldSimulationTurn
    // cannot feed back into the same turn's cognition or Character Brain.
    const subjectiveCognitionProjection =
      projectWorldSimulationSubjectiveCognition({
        world_state: worldState,
        character,
        current_turn_id: turnId,
      });

    subjectiveCognitionProjections.push({
      character,
      version: subjectiveCognitionProjection.version,
      projection_hash:
        hashAgentRunValue(
          subjectiveCognitionProjection.character_view,
        ),
      audit: cloneJson(subjectiveCognitionProjection.audit),
    });

    // Phase66C adds a consumer-specific effective-belief DTO beside the
    // Phase65C claim/relation view. This happens during prepare, before any
    // same-turn Phase65A/65B/65D/66A writes, so only committed prior-turn
    // revision history can influence Character Brain or Action Proposer.
    const subjectiveBeliefCharacterProjection =
      projectWorldSimulationSubjectiveBeliefsForCharacter({
        world_state: worldState,
        character,
        current_turn_id: turnId,
      });

    subjectiveBeliefCharacterProjections.push({
      character,
      version: subjectiveBeliefCharacterProjection.version,
      character_view_hash:
        subjectiveBeliefCharacterProjection.character_view_hash,
      audit: cloneJson(subjectiveBeliefCharacterProjection.audit),
    });

    // Phase67E reconstructs a bounded autobiographical overview from already
    // committed Phase67B/C/D organization. It runs during prepare, before any
    // same-turn autobiographical writes, so current-turn organization cannot
    // retroactively influence the Character Brain or Action Proposer.
    const autobiographicalSummaryCharacterProjection =
      projectWorldSimulationAutobiographicalSummaryForCharacter({
        world_state: worldState,
        character,
        current_turn_id: turnId,
      });

    autobiographicalSummaryCharacterProjections.push({
      character,
      version: autobiographicalSummaryCharacterProjection.version,
      character_view_hash:
        autobiographicalSummaryCharacterProjection.character_view_hash,
      audit: cloneJson(autobiographicalSummaryCharacterProjection.audit),
    });

    // Phase68A projects only already committed prior-turn interpretation
    // history. New interpretations are created later during resolve, after the
    // Character Brain decision, so they cannot retroactively alter this turn.
    const autobiographicalSelfInterpretationCharacterProjection =
      projectWorldSimulationAutobiographicalSelfInterpretationsForCharacter({
        world_state: worldState,
        character,
        current_turn_id: turnId,
      });

    autobiographicalSelfInterpretationCharacterProjections.push({
      character,
      version: autobiographicalSelfInterpretationCharacterProjection.version,
      character_view_hash:
        autobiographicalSelfInterpretationCharacterProjection.character_view_hash,
      audit:
        cloneJson(autobiographicalSelfInterpretationCharacterProjection.audit),
    });

    // Phase68B exposes only committed prior-turn structured self-model aspects.
    // New aspects are formed later during resolve, so the same Character Brain
    // decision can never consume a self-model write that it indirectly caused.
    const structuredSelfModelCharacterProjection =
      projectWorldSimulationStructuredSelfModelForCharacter({
        world_state: worldState,
        character,
        current_turn_id: turnId,
      });

    structuredSelfModelCharacterProjections.push({
      character,
      version: structuredSelfModelCharacterProjection.version,
      character_view_hash: structuredSelfModelCharacterProjection.character_view_hash,
      audit: cloneJson(structuredSelfModelCharacterProjection.audit),
    });

    // Phase68C replays committed Phase68B formation plus prior committed
    // revision history. It runs during prepare, so current-turn revision writes
    // remain unavailable to the Character Brain that indirectly caused them.
    const revisedStructuredSelfModelCharacterProjection =
      projectWorldSimulationRevisedStructuredSelfModelForCharacter({
        world_state: worldState,
        character,
        current_turn_id: turnId,
      });

    revisedStructuredSelfModelCharacterProjections.push({
      character,
      version: revisedStructuredSelfModelCharacterProjection.version,
      character_view_hash:
        revisedStructuredSelfModelCharacterProjection.character_view_hash,
      audit: cloneJson(revisedStructuredSelfModelCharacterProjection.audit),
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
    const characterCognition = {
      ...object(
        cloneJson(
          cognition.character_view
          ?? cognition,
        ),
      ),
      // Engine-owned Phase65C claims/relations and Phase66C effective beliefs
      // win over any neural capability attempt to omit or rewrite this bounded
      // committed-subjective view.
      subjective_cognition:
        cloneJson({
          ...subjectiveCognitionProjection.character_view,
          belief_source:
            subjectiveBeliefCharacterProjection.character_view.source,
          beliefs:
            subjectiveBeliefCharacterProjection.character_view.beliefs,
          beliefs_truncated:
            subjectiveBeliefCharacterProjection.character_view.beliefs_truncated,
        }),
      autobiographical_context:
        cloneJson(
          autobiographicalSummaryCharacterProjection.character_view,
        ),
      self_interpretation_context:
        cloneJson(
          autobiographicalSelfInterpretationCharacterProjection.character_view,
        ),
      self_model_context:
        cloneJson(
          revisedStructuredSelfModelCharacterProjection.character_view,
        ),
    };
    characterCognition.experiential_method_guidance = cloneJson(
      experientialMethodCompetitionGuidance.character_view,
    );
    characterCognition.experiential_method_impasse_deliberation = cloneJson({
      source: "phase79d_bounded_experiential_method_impasse_substates",
      impasse_contexts: experientialMethodImpasseDeliberation.impasse_contexts,
      deliberation_required: experientialMethodImpasseDeliberation.deliberation_required,
      new_preference_authority: false,
      selected_action_authority: false,
      semantic_revision_authority: false,
    });
    // Phase79E exposes only already-character-visible current context as a
    // bounded cue catalog beside each Phase79D tie/conflict impasse. It does
    // not decide a preference; downstream qualitative re-resolution may use
    // these cues instead of inventing an arbitrary tie-break.
    const experientialMethodImpasseDiscriminatingEvidence =
      projectWorldSimulationExperientialMethodImpasseDiscriminatingEvidence({
        experiential_method_impasse_deliberation:
          experientialMethodImpasseDeliberation,
        current_context: {
          perception: characterPerception,
          attention: speculativeCurrentMind.character_facing_attention,
          working_context: speculativeCurrentMind.working_context,
          subjective_cognition: characterCognition.subjective_cognition,
          self_interpretation_context: characterCognition.self_interpretation_context,
          self_model_context: characterCognition.self_model_context,
        },
      });
    experientialMethodImpasseDiscriminatingEvidenceProjections.push(
      cloneJson(experientialMethodImpasseDiscriminatingEvidence),
    );
    characterCognition.experiential_method_impasse_discriminating_evidence =
      cloneJson({
        source: "phase79e_current_context_discriminating_evidence_candidates",
        impasse_evidence_contexts:
          experientialMethodImpasseDiscriminatingEvidence.impasse_evidence_contexts,
        deliberation_evidence_available:
          experientialMethodImpasseDiscriminatingEvidence.deliberation_evidence_available,
        preference_authority: false,
        selected_action_authority: false,
        semantic_revision_authority: false,
      });

    // Phase79F lets the impasse substate return evidence-backed qualitative
    // preference results to the existing Phase79B decision kernel. The hook
    // sees only the bounded Phase79D/79E surface; engine-owned Phase79B source
    // state is used only after the hook returns. The resulting Phase79B
    // projection is then compiled through the existing Phase79C guidance path
    // so Action Proposer receives one effective method-guidance surface.
    const experientialMethodImpasseReresolutionResolverView =
      buildWorldSimulationExperientialMethodImpasseReresolutionResolverView({
        source_phase79b_resolver_view:
          experientialMethodCompetitionResolutionResolverView,
        source_phase79b_resolution:
          experientialMethodCompetitionResolution,
        source_phase79d_impasse_deliberation:
          experientialMethodImpasseDeliberation,
        source_phase79e_discriminating_evidence:
          experientialMethodImpasseDiscriminatingEvidence,
      });
    const experientialMethodImpasseReresolutionResolver =
      typeof options.experientialMethodImpasseReresolutionResolver === "function"
        ? options.experientialMethodImpasseReresolutionResolver
        : null;
    const rawExperientialMethodImpassePreferenceRevisions =
      experientialMethodImpasseReresolutionResolver
        ? await experientialMethodImpasseReresolutionResolver(
          cloneJson(experientialMethodImpasseReresolutionResolverView),
        )
        : [];
    if (!Array.isArray(rawExperientialMethodImpassePreferenceRevisions)) {
      const error = new Error(
        "experientialMethodImpasseReresolutionResolver must return an array of evidence-backed preference revisions.",
      );
      error.code =
        "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RERESOLUTION_RESOLVER_INVALID_OUTPUT";
      throw error;
    }
    const experientialMethodImpasseReresolution =
      projectWorldSimulationExperientialMethodImpasseReresolution({
        resolver_view:
          experientialMethodImpasseReresolutionResolverView,
        source_phase79b_resolver_view:
          experientialMethodCompetitionResolutionResolverView,
        source_phase79b_resolution:
          experientialMethodCompetitionResolution,
        source_phase79d_impasse_deliberation:
          experientialMethodImpasseDeliberation,
        source_phase79e_discriminating_evidence:
          experientialMethodImpasseDiscriminatingEvidence,
        preference_revisions:
          rawExperientialMethodImpassePreferenceRevisions,
      });
    experientialMethodImpasseReresolutionProjections.push(
      cloneJson(experientialMethodImpasseReresolution),
    );
    const effectiveExperientialMethodCompetitionGuidance =
      projectWorldSimulationExperientialMethodCompetitionGuidance({
        experiential_method_transfer: experientialMethodTransfer,
        experiential_method_competition_resolution:
          experientialMethodImpasseReresolution.effective_competition_resolution,
      });
    experientialMethodCompetitionGuidanceProjections[
      experientialMethodCompetitionGuidanceProjections.length - 1
    ] = cloneJson(effectiveExperientialMethodCompetitionGuidance);
    characterCognition.experiential_method_guidance = cloneJson(
      effectiveExperientialMethodCompetitionGuidance.character_view,
    );
    const remainingExperientialMethodImpasseRefs = new Set(
      experientialMethodImpasseReresolution.remaining_impasse_refs,
    );
    characterCognition.experiential_method_impasse_deliberation = cloneJson({
      source: "phase79f_remaining_experiential_method_impasses",
      impasse_contexts: experientialMethodImpasseDeliberation.impasse_contexts
        .filter((context) => remainingExperientialMethodImpasseRefs.has(context.impasse_ref)),
      deliberation_required:
        experientialMethodImpasseReresolution.remaining_impasse_count > 0,
      new_preference_authority: false,
      selected_action_authority: false,
      semantic_revision_authority: false,
    });
    characterCognition.experiential_method_impasse_discriminating_evidence =
      cloneJson({
        source: "phase79f_remaining_impasse_discriminating_evidence",
        impasse_evidence_contexts:
          experientialMethodImpasseDiscriminatingEvidence.impasse_evidence_contexts
            .filter((context) => remainingExperientialMethodImpasseRefs.has(context.impasse_ref)),
        deliberation_evidence_available:
          experientialMethodImpasseReresolution.remaining_impasse_count > 0
          && experientialMethodImpasseDiscriminatingEvidence.deliberation_evidence_available,
        preference_authority: false,
        selected_action_authority: false,
        semantic_revision_authority: false,
      });
    characterCognition.experiential_method_impasse_reresolution =
      cloneJson(experientialMethodImpasseReresolution.character_view);

    // Phase79I reconstructs same-character prior committed impasse-resolution
    // precedents only for impasses that remain unresolved after the current
    // Phase79F pass. Cross-turn identity is exact normalized method-skeleton
    // equality; historical resolution cues are compared to current Phase79E
    // cues by exact kind+content only. This stays engine-side in Phase79I so a
    // precedent cannot bypass Phase79F and silently become an action choice or
    // comparative preference.
    const experientialMethodImpassePrecedentReentry =
      projectWorldSimulationExperientialMethodImpassePrecedentReentry({
        world_simulation_session_id: sessionId,
        character,
        current_turn_id: turnId,
        current_state_revision: snapshot.revision,
        current_world_state_hash: snapshot.state_hash,
        world_history: worldHistory,
        current_impasse_deliberation: experientialMethodImpasseDeliberation,
        current_impasse_discriminating_evidence:
          experientialMethodImpasseDiscriminatingEvidence,
        current_impasse_reresolution: experientialMethodImpasseReresolution,
      });
    experientialMethodImpassePrecedentReentryProjections.push(
      cloneJson(experientialMethodImpassePrecedentReentry),
    );

    // Phase79J gives prior evaluated precedents one bounded chance to help the
    // unresolved impasse substate produce new qualitative preferences. Only
    // Phase79I precedents whose historical resolution cues all exactly match
    // current context enter the resolver view. The resolver cannot see raw
    // history/world truth and cannot select an action; its output is replayed
    // through the existing Phase79B decision kernel and Phase79C compiler.
    const experientialMethodImpassePrecedentReresolutionResolverView =
      buildWorldSimulationExperientialMethodImpassePrecedentReresolutionResolverView({
        source_phase79b_resolver_view:
          experientialMethodCompetitionResolutionResolverView,
        source_phase79f_reresolution:
          experientialMethodImpasseReresolution,
        source_phase79i_precedent_reentry:
          experientialMethodImpassePrecedentReentry,
      });
    const experientialMethodImpassePrecedentReresolutionResolver =
      typeof options.experientialMethodImpassePrecedentReresolutionResolver === "function"
        ? options.experientialMethodImpassePrecedentReresolutionResolver
        : null;
    const rawExperientialMethodImpassePrecedentPreferenceRevisions =
      experientialMethodImpassePrecedentReresolutionResolver
        ? await experientialMethodImpassePrecedentReresolutionResolver(
          cloneJson(experientialMethodImpassePrecedentReresolutionResolverView),
        )
        : [];
    if (!Array.isArray(rawExperientialMethodImpassePrecedentPreferenceRevisions)) {
      const error = new Error(
        "experientialMethodImpassePrecedentReresolutionResolver must return an array of precedent-grounded qualitative preference revisions.",
      );
      error.code =
        "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_RERESOLUTION_RESOLVER_INVALID_OUTPUT";
      throw error;
    }
    const experientialMethodImpassePrecedentReresolution =
      projectWorldSimulationExperientialMethodImpassePrecedentReresolution({
        resolver_view:
          experientialMethodImpassePrecedentReresolutionResolverView,
        source_phase79b_resolver_view:
          experientialMethodCompetitionResolutionResolverView,
        source_phase79f_reresolution:
          experientialMethodImpasseReresolution,
        source_phase79i_precedent_reentry:
          experientialMethodImpassePrecedentReentry,
        preference_revisions:
          rawExperientialMethodImpassePrecedentPreferenceRevisions,
      });
    experientialMethodImpassePrecedentReresolutionProjections.push(
      cloneJson(experientialMethodImpassePrecedentReresolution),
    );
    const precedentEffectiveExperientialMethodCompetitionGuidance =
      projectWorldSimulationExperientialMethodCompetitionGuidance({
        experiential_method_transfer: experientialMethodTransfer,
        experiential_method_competition_resolution:
          experientialMethodImpassePrecedentReresolution.effective_competition_resolution,
      });
    experientialMethodCompetitionGuidanceProjections[
      experientialMethodCompetitionGuidanceProjections.length - 1
    ] = cloneJson(precedentEffectiveExperientialMethodCompetitionGuidance);
    characterCognition.experiential_method_guidance = cloneJson(
      precedentEffectiveExperientialMethodCompetitionGuidance.character_view,
    );
    const remainingExperientialMethodImpasseRefsAfterPrecedent = new Set(
      experientialMethodImpassePrecedentReresolution.remaining_impasse_refs,
    );
    characterCognition.experiential_method_impasse_deliberation = cloneJson({
      source: "phase79j_remaining_experiential_method_impasses",
      impasse_contexts: experientialMethodImpasseDeliberation.impasse_contexts
        .filter((context) => remainingExperientialMethodImpasseRefsAfterPrecedent.has(context.impasse_ref)),
      deliberation_required:
        experientialMethodImpassePrecedentReresolution.remaining_impasse_count > 0,
      new_preference_authority: false,
      selected_action_authority: false,
      semantic_revision_authority: false,
    });
    characterCognition.experiential_method_impasse_discriminating_evidence =
      cloneJson({
        source: "phase79j_remaining_impasse_discriminating_evidence",
        impasse_evidence_contexts:
          experientialMethodImpasseDiscriminatingEvidence.impasse_evidence_contexts
            .filter((context) => remainingExperientialMethodImpasseRefsAfterPrecedent.has(context.impasse_ref)),
        deliberation_evidence_available:
          experientialMethodImpassePrecedentReresolution.remaining_impasse_count > 0
          && experientialMethodImpasseDiscriminatingEvidence.deliberation_evidence_available,
        preference_authority: false,
        selected_action_authority: false,
        semantic_revision_authority: false,
      });
    const phase79jResultByImpasseRef = new Map(
      experientialMethodImpassePrecedentReresolution.character_view.impasse_results
        .map((result) => [result.impasse_ref, result]),
    );
    characterCognition.experiential_method_impasse_reresolution = cloneJson({
      source: "phase79j_precedent_grounded_experiential_method_impasse_reresolution",
      impasse_results: experientialMethodImpasseReresolution.character_view.impasse_results
        .map((result) => phase79jResultByImpasseRef.get(result.impasse_ref) ?? result),
      deliberation_required:
        experientialMethodImpassePrecedentReresolution.remaining_impasse_count > 0,
      precedent_refs_exposed: false,
      historical_outcome_details_exposed: false,
      advisory_only: true,
      selected_action_authority: false,
      semantic_revision_authority: false,
      world_truth_authority: false,
    });

    // Phase69C activates only committed prior-turn Phase69A/69B plans against
    // the bounded Character-facing context already assembled above. Activation
    // is advisory to Action Proposer; it cannot select or execute an action.
    const implementationIntentionActivationResolverView =
      buildWorldSimulationGoalImplementationIntentionActivationResolverView({
        world_state: worldState,
        character,
        current_turn_id: turnId,
        current_context: {
          perception: characterPerception,
          attention: speculativeCurrentMind.character_facing_attention,
          working_context: speculativeCurrentMind.working_context,
          subjective_cognition: characterCognition.subjective_cognition,
          self_interpretation_context: characterCognition.self_interpretation_context,
          self_model_context: characterCognition.self_model_context,
        },
      });
    const implementationIntentionActivationResolver =
      typeof options.implementationIntentionCueActivationResolver === "function"
        ? options.implementationIntentionCueActivationResolver
        : null;
    const rawActivatedPlanRefs = implementationIntentionActivationResolver
      ? await implementationIntentionActivationResolver(
        cloneJson(implementationIntentionActivationResolverView),
      )
      : [];
    if (!Array.isArray(rawActivatedPlanRefs)) {
      const error = new Error(
        "implementationIntentionCueActivationResolver must return an array of opaque plan refs.",
      );
      error.code =
        "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_ACTIVATION_RESOLVER_INVALID_OUTPUT";
      throw error;
    }
    const implementationIntentionActivation =
      projectWorldSimulationGoalImplementationIntentionActivation({
        resolver_view: implementationIntentionActivationResolverView,
        activated_plan_refs: rawActivatedPlanRefs,
      });
    characterCognition.implementation_intention_guidance = cloneJson({
      source: "committed_prior_turn_cue_applicable_implementation_intentions",
      implementation_intentions:
        implementationIntentionActivation.implementation_intention_guidance,
      advisory_only: true,
      selected_action_authority: false,
    });

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

    // Phase76F records an explicit provenance edge from a Phase76E transferred
    // method to an already-existing Action Proposer candidate. The resolver may
    // only select canonical transfer_ref/action_ref pairs; it cannot author a
    // method, action, selection, outcome, or causal credit. This projection is
    // engine-side provenance and does not alter the character-facing candidate
    // universe or bias the final Character Brain choice surface.
    const experientialMethodCandidateAttributionResolverView =
      buildWorldSimulationExperientialMethodCandidateAttributionResolverView({
        character,
        current_turn_id: turnId,
        experiential_method_transfer: experientialMethodTransfer,
        cognition: characterCognition,
        candidate_action_intents:
          characterActionCandidates.candidate_action_intents ?? [],
      });
    const experientialMethodCandidateAttributionResolver =
      typeof options.experientialMethodCandidateAttributionResolver === "function"
        ? options.experientialMethodCandidateAttributionResolver
        : null;
    const rawExperientialMethodCandidateAttributions =
      experientialMethodCandidateAttributionResolver
        ? await experientialMethodCandidateAttributionResolver(
          cloneJson(experientialMethodCandidateAttributionResolverView),
        )
        : [];
    if (!Array.isArray(rawExperientialMethodCandidateAttributions)) {
      const error = new Error(
        "experientialMethodCandidateAttributionResolver must return an array of transfer_ref/action_ref pairs.",
      );
      error.code =
        "WORLD_SIMULATION_EXPERIENTIAL_METHOD_APPLICATION_RESOLVER_INVALID_OUTPUT";
      throw error;
    }
    const experientialMethodCandidateAttribution =
      projectWorldSimulationExperientialMethodCandidateAttribution({
        resolver_view: experientialMethodCandidateAttributionResolverView,
        candidate_attributions: rawExperientialMethodCandidateAttributions,
      });
    experientialMethodCandidateAttributionProjections.push(
      cloneJson(experientialMethodCandidateAttribution),
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
        phase73a_visible_constraint_observation_installed: true,
        phase73a_visible_constraint_observation_projection_version:
          visibleConstraintObservationCharacterProjectionVersion,
        phase73a_same_character_committed_prior_revision_only: true,
        phase73a_actual_means_feasibility_verdict_exposed: false,
        phase73a_world_truth_authority_exposed: false,
        phase73a_same_turn_feedback_allowed: false,
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

        phase63c_recovered_memory_upstream_channel:
          "recovered_memories",

        native_character_brain_memory_channel:
          "cognition.working_context",

        selective_working_memory_input_gating_v4_installed:
          true,

        rejected_perception_remains_available_in_bounded_perception:
          true,

        working_context_contains_only_admitted_or_maintained_new_semantics:
          true,

        selective_working_memory_output_gating_v5_installed:
          true,

        output_gating_installed:
          true,

        output_gate_version:
          worldSimulationCharacterWorkingMemoryOutputGateVersion,

        output_gate_closed_representation_remains_in_current_mind:
          true,

        output_gate_reason_codes_exposed_to_character_brain:
          false,

        recollection_reinstatement_v3_installed:
          true,

        recollection_context_origin:
          "recovered_memory",

        recollection_single_semantic_exposure_enforced:
          true,

        raw_recovered_memories_forwarded_at_final_brain_ingress:
          false,

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

        subjective_cognition_read_projection_installed:
          true,

        subjective_cognition_projection_version:
          worldSimulationSubjectiveCognitionProjectionVersion,

        subjective_cognition_source:
          "same_character_committed_prior_turn_claim_history_only",

        subjective_cognition_same_turn_claim_feedback_allowed:
          false,

        subjective_cognition_world_truth_authority_exposed:
          false,

        subjective_cognition_confidence_probability_exposed:
          false,

        subjective_cognition_claim_evidence_exposed:
          false,

        subjective_cognition_candidate_supersession_is_truth_resolution:
          false,

        subjective_belief_character_projection_installed:
          true,

        subjective_belief_character_projection_version:
          worldSimulationSubjectiveBeliefCharacterProjectionVersion,

        subjective_belief_character_source:
          "same_character_committed_prior_turn_effective_subjective_beliefs_only",

        subjective_belief_same_turn_revision_feedback_allowed:
          false,

        subjective_belief_claim_identity_exposed:
          false,

        subjective_belief_revision_identity_exposed:
          false,

        subjective_belief_confidence_probability_exposed:
          false,

        subjective_belief_world_truth_authority_exposed:
          false,

        subjective_belief_duplicate_claim_count_used_as_credibility:
          false,

        autobiographical_summary_read_projection_installed:
          true,

        autobiographical_summary_character_projection_version:
          worldSimulationAutobiographicalSummaryCharacterProjectionVersion,

        autobiographical_summary_source:
          "same_character_committed_prior_turn_phase67b_phase67c_phase67d_only",

        autobiographical_summary_same_turn_feedback_allowed:
          false,

        autobiographical_summary_source_ids_hashes_exposed:
          false,

        autobiographical_summary_freeform_narrative_generated:
          false,

        autobiographical_summary_self_model_exposed:
          false,

        autobiographical_summary_world_truth_authority_exposed:
          false,

        autobiographical_summary_confidence_probability_exposed:
          false,

        autobiographical_self_interpretation_projection_installed:
          true,

        autobiographical_self_interpretation_projection_version:
          autobiographicalSelfInterpretationCharacterProjectionVersion,

        autobiographical_self_interpretation_source:
          "same_character_committed_prior_turn_interpretation_history_only",

        autobiographical_self_interpretation_same_turn_feedback_allowed:
          false,

        autobiographical_self_interpretation_source_ids_hashes_exposed:
          false,

        autobiographical_self_interpretation_world_truth_authority_exposed:
          false,

        autobiographical_self_interpretation_belief_authority_exposed:
          false,

        autobiographical_self_interpretation_self_model_exposed:
          false,

        autobiographical_self_interpretation_freeform_life_story_generated:
          false,

        structured_self_model_projection_installed:
          true,

        structured_self_model_projection_version:
          structuredSelfModelCharacterProjectionVersion,

        structured_self_model_source:
          "same_character_committed_prior_turn_structured_self_model_history_only",

        structured_self_model_same_turn_feedback_allowed:
          false,

        structured_self_model_source_ids_hashes_exposed:
          false,

        structured_self_model_world_truth_authority_exposed:
          false,

        structured_self_model_accuracy_clarity_authority_exposed:
          false,

        structured_self_model_numeric_scores_exposed:
          false,

        structured_self_model_motivation_goal_authority_exposed:
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
    subjective_cognition_projections: cloneJson(subjectiveCognitionProjections),
    subjective_belief_character_projections:
      cloneJson(subjectiveBeliefCharacterProjections),
    experiential_knowledge_reentry_projections:
      cloneJson(experientialKnowledgeReentryProjections),
    experiential_method_transfer_projections:
      cloneJson(experientialMethodTransferProjections),
    experiential_method_competition_projections:
      cloneJson(experientialMethodCompetitionProjections),
    experiential_method_competition_resolution_projections:
      cloneJson(experientialMethodCompetitionResolutionProjections),
    experiential_method_competition_guidance_projections:
      cloneJson(experientialMethodCompetitionGuidanceProjections),
    experiential_method_impasse_deliberation_projections:
      cloneJson(experientialMethodImpasseDeliberationProjections),
    experiential_method_impasse_discriminating_evidence_projections:
      cloneJson(experientialMethodImpasseDiscriminatingEvidenceProjections),
    experiential_method_impasse_reresolution_projections:
      cloneJson(experientialMethodImpasseReresolutionProjections),
    experiential_method_impasse_precedent_reentry_projections:
      cloneJson(experientialMethodImpassePrecedentReentryProjections),
    experiential_method_impasse_precedent_reresolution_projections:
      cloneJson(experientialMethodImpassePrecedentReresolutionProjections),
    experiential_method_candidate_attribution_projections:
      cloneJson(experientialMethodCandidateAttributionProjections),
    autobiographical_summary_character_projections:
      cloneJson(autobiographicalSummaryCharacterProjections),
    autobiographical_self_interpretation_character_projections:
      cloneJson(autobiographicalSelfInterpretationCharacterProjections),
    structured_self_model_character_projections:
      cloneJson(structuredSelfModelCharacterProjections),
    revised_structured_self_model_character_projections:
      cloneJson(revisedStructuredSelfModelCharacterProjections),
    visible_constraint_observation_projections:
      cloneJson(visibleConstraintObservationProjections),
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
      visible_constraint_observation_version:
        worldSimulationVisibleConstraintObservationVersion,
      visible_constraint_observation_projection_version:
        visibleConstraintObservationCharacterProjectionVersion,
      visible_constraint_observation_committed_prior_revision_only: true,
      visible_constraint_observation_same_character_only: true,
      visible_constraint_observation_actual_means_verdict_not_forwarded: true,
      visible_constraint_observation_world_truth_authority_not_forwarded: true,
      visible_constraint_observation_same_turn_feedback_allowed: false,
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

      phase63c_recovered_memory_upstream_channel:
        "recovered_memories",

      native_character_brain_memory_channel:
        "cognition.working_context",

      selective_working_memory_input_gating_v4_installed:
        true,

      rejected_perception_remains_available_in_bounded_perception:
        true,

      working_context_contains_only_admitted_or_maintained_new_semantics:
        true,

      selective_working_memory_output_gating_v5_installed:
        true,

      output_gating_installed:
        true,

      output_gate_version:
        worldSimulationCharacterWorkingMemoryOutputGateVersion,

      output_gate_closed_representation_remains_in_current_mind:
        true,

      output_gate_reason_codes_exposed_to_character_brain:
        false,

      recollection_reinstatement_v3_installed:
        true,

      recollection_single_semantic_exposure_enforced:
        true,

      raw_recovered_memories_forwarded_at_final_brain_ingress:
        false,

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

      subjective_cognition_read_projection_installed:
        true,

      subjective_cognition_projection_version:
        worldSimulationSubjectiveCognitionProjectionVersion,

      subjective_cognition_committed_prior_turn_only:
        true,

      subjective_cognition_same_turn_feedback_allowed:
        false,

      subjective_cognition_world_truth_authority_exposed:
        false,

      subjective_cognition_claim_evidence_exposed:
        false,

      subjective_cognition_candidate_supersession_is_truth_resolution:
        false,

      subjective_belief_character_projection_installed:
        true,

      subjective_belief_character_projection_version:
        worldSimulationSubjectiveBeliefCharacterProjectionVersion,

      subjective_belief_committed_prior_turn_only:
        true,

      subjective_belief_same_turn_revision_feedback_allowed:
        false,

      subjective_belief_engine_identity_not_forwarded_to_character_brain:
        true,

      subjective_belief_world_truth_authority_not_forwarded_to_character_brain:
        true,

      autobiographical_summary_read_projection_installed:
        true,

      autobiographical_summary_character_projection_version:
        worldSimulationAutobiographicalSummaryCharacterProjectionVersion,

      autobiographical_summary_committed_prior_turn_only:
        true,

      autobiographical_summary_same_turn_feedback_allowed:
        false,

      autobiographical_summary_source_ids_hashes_not_forwarded_to_character_brain:
        true,

      autobiographical_summary_freeform_narrative_not_generated:
        true,

      autobiographical_summary_self_model_not_forwarded_to_character_brain:
        true,

      autobiographical_summary_world_truth_authority_not_forwarded_to_character_brain:
        true,

      autobiographical_self_interpretation_read_projection_installed:
        true,

      autobiographical_self_interpretation_character_projection_version:
        autobiographicalSelfInterpretationCharacterProjectionVersion,

      autobiographical_self_interpretation_committed_prior_turn_only:
        true,

      autobiographical_self_interpretation_same_turn_feedback_allowed:
        false,

      autobiographical_self_interpretation_source_ids_hashes_not_forwarded_to_character_brain:
        true,

      autobiographical_self_interpretation_world_truth_authority_not_forwarded_to_character_brain:
        true,

      autobiographical_self_interpretation_belief_authority_not_forwarded_to_character_brain:
        true,

      autobiographical_self_interpretation_self_model_not_forwarded_to_character_brain:
        true,

      structured_self_model_read_projection_installed:
        true,

      structured_self_model_character_projection_version:
        structuredSelfModelCharacterProjectionVersion,

      structured_self_model_committed_prior_turn_only:
        true,

      structured_self_model_same_turn_feedback_allowed:
        false,

      structured_self_model_source_ids_hashes_not_forwarded_to_character_brain:
        true,

      structured_self_model_world_truth_authority_not_forwarded_to_character_brain:
        true,

      structured_self_model_accuracy_clarity_authority_not_forwarded_to_character_brain:
        true,

      structured_self_model_numeric_scores_not_forwarded_to_character_brain:
        true,

      structured_self_model_motivation_goal_authority_not_forwarded_to_character_brain:
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

function subjectiveClaimSourceMemoryRecords(
  subjectiveMemoryFormation,
) {
  return array(
    subjectiveMemoryFormation?.result?.character_updates,
  ).flatMap(
    (update) =>
      array(update?.memory_records)
        .map(
          (memoryRecord) => ({
            character:
              update?.character
              ?? null,
            memory_record:
              cloneJson(memoryRecord),
          }),
        ),
  );
}

async function resolveAutobiographicalLifeEventOrganizationDecisions(
  worldState,
  preparedTurn,
  sourceSegmentationEventIds,
  options,
) {
  const resolver =
    typeof options.autobiographicalLifeEventOrganizationResolver === "function"
      ? options.autobiographicalLifeEventOrganizationResolver
      : null;

  const resolverView =
    buildWorldSimulationAutobiographicalLifeEventResolverView({
      world_state:
        worldState,
      turn_id:
        preparedTurn.turn_id,
      source_segmentation_event_ids:
        sourceSegmentationEventIds,
    });

  if (!resolver) {
    return {
      decisions: [],
      resolver_view:
        resolverView,
      audit: {
        resolver_used:
          false,
        missing_resolver_defaults_new_episode_to_new_life_event:
          true,
        current_turn_phase67a_episode_updates_only:
          true,
        world_state_exposed_to_resolver:
          false,
        raw_world_event_exposed_to_resolver:
          false,
        memory_content_exposed_to_resolver:
          false,
        episode_content_exposed_to_resolver:
          false,
        temporal_contiguity_alone_is_sufficient:
          false,
        spatial_contiguity_alone_is_sufficient:
          false,
        confidence_probability_requested:
          false,
        world_truth_judgment_requested:
          false,
      },
    };
  }

  const inputSnapshot =
    cloneJson(resolverView);
  const inputHash =
    hashAgentRunValue(inputSnapshot);
  const raw =
    await resolver(cloneJson(inputSnapshot));

  if (!Array.isArray(raw)) {
    const error = new Error(
      "autobiographicalLifeEventOrganizationResolver must return an array of source-backed organization decisions.",
    );
    error.code =
      "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_EVENT_RESOLVER_INVALID_OUTPUT";
    throw error;
  }

  const decisions = raw.map((decision) => ({
    ...cloneJson(decision),
    resolver_view_hash:
      resolverView.resolver_view_hash,
    source:
      "programmatic_autobiographical_life_event_organization_resolver",
  }));

  return {
    decisions,
    resolver_view:
      resolverView,
    audit: {
      resolver_used:
        true,
      input_context_hash:
        inputHash,
      decision_count:
        decisions.length,
      current_turn_phase67a_episode_updates_only:
        true,
      world_state_exposed_to_resolver:
        false,
      raw_world_event_exposed_to_resolver:
        false,
      memory_content_exposed_to_resolver:
        false,
      episode_content_exposed_to_resolver:
        false,
      temporal_contiguity_alone_is_sufficient:
        false,
      spatial_contiguity_alone_is_sufficient:
        false,
      confidence_probability_requested:
        false,
      world_truth_judgment_requested:
        false,
    },
  };
}

async function resolvePersonalSemanticMemoryDecisions(
  worldState,
  preparedTurn,
  sourceOrganizationEventIds,
  options,
) {
  const resolver =
    typeof options.personalSemanticMemoryResolver === "function"
      ? options.personalSemanticMemoryResolver
      : null;
  const resolverView =
    buildWorldSimulationPersonalSemanticMemoryResolverView({
      world_state: worldState,
      turn_id: preparedTurn.turn_id,
      source_organization_event_ids: sourceOrganizationEventIds,
    });
  if (!resolver) {
    return {
      decisions: [],
      resolver_view: resolverView,
      audit: {
        resolver_used: false,
        missing_resolver_means_no_semanticization: true,
        current_turn_life_event_trigger_required: true,
        eager_semanticization_used: false,
        recurring_event_pattern_auto_promoted_by_count: false,
        world_state_exposed_to_resolver: false,
        raw_world_event_exposed_to_resolver: false,
        memory_content_exposed_to_resolver: false,
        episode_content_exposed_to_resolver: false,
        life_event_content_exposed_to_resolver: false,
        trait_inference_requested: false,
        role_identity_inference_requested: false,
        self_model_inference_requested: false,
        epistemic_acceptance_requested: false,
        confidence_probability_requested: false,
        world_truth_judgment_requested: false,
      },
    };
  }
  const inputSnapshot = cloneJson(resolverView);
  const inputHash = hashAgentRunValue(inputSnapshot);
  const raw = await resolver(cloneJson(inputSnapshot));
  if (!Array.isArray(raw)) {
    const error = new Error(
      "personalSemanticMemoryResolver must return an array of source-backed semantic derivation decisions.",
    );
    error.code = "WORLD_SIMULATION_PERSONAL_SEMANTIC_RESOLVER_INVALID_OUTPUT";
    throw error;
  }
  const decisions = raw.map((decision) => ({
    ...cloneJson(decision),
    resolver_view_hash: resolverView.resolver_view_hash,
    source: "programmatic_personal_semantic_memory_resolver",
  }));
  return {
    decisions,
    resolver_view: resolverView,
    audit: {
      resolver_used: true,
      input_context_hash: inputHash,
      decision_count: decisions.length,
      current_turn_life_event_trigger_required: true,
      eager_semanticization_used: false,
      recurring_event_pattern_auto_promoted_by_count: false,
      world_state_exposed_to_resolver: false,
      raw_world_event_exposed_to_resolver: false,
      memory_content_exposed_to_resolver: false,
      episode_content_exposed_to_resolver: false,
      life_event_content_exposed_to_resolver: false,
      trait_inference_requested: false,
      role_identity_inference_requested: false,
      self_model_inference_requested: false,
      epistemic_acceptance_requested: false,
      confidence_probability_requested: false,
      world_truth_judgment_requested: false,
    },
  };
}

async function resolveAutobiographicalLifePeriodOrganizationDecisions(
  worldState,
  preparedTurn,
  sourceOrganizationEventIds,
  sourceSemanticDerivationEventIds,
  options,
) {
  const resolver =
    typeof options.autobiographicalLifePeriodOrganizationResolver === "function"
      ? options.autobiographicalLifePeriodOrganizationResolver
      : null;
  const resolverView =
    buildWorldSimulationAutobiographicalLifePeriodResolverView({
      world_state: worldState,
      turn_id: preparedTurn.turn_id,
      source_organization_event_ids: sourceOrganizationEventIds,
      source_semantic_derivation_event_ids: sourceSemanticDerivationEventIds,
    });
  if (!resolver) {
    return {
      decisions: [],
      resolver_view: resolverView,
      audit: {
        resolver_used: false,
        missing_resolver_means_no_period_organization: true,
        current_turn_autobiographical_trigger_required: true,
        overlapping_periods_allowed: true,
        many_to_many_life_event_membership: true,
        temporal_adjacency_alone_used: false,
        calendar_bucket_used: false,
        fixed_duration_threshold_used: false,
        world_state_exposed_to_resolver: false,
        raw_world_event_exposed_to_resolver: false,
        memory_content_exposed_to_resolver: false,
        life_event_content_exposed_to_resolver: false,
        freeform_llm_period_authority_used: false,
        cultural_life_script_assumption_used: false,
        self_model_inference_requested: false,
        belief_revision_requested: false,
        confidence_probability_requested: false,
        world_truth_judgment_requested: false,
      },
    };
  }
  const inputSnapshot = cloneJson(resolverView);
  const inputHash = hashAgentRunValue(inputSnapshot);
  const raw = await resolver(cloneJson(inputSnapshot));
  if (!Array.isArray(raw)) {
    const error = new Error(
      "autobiographicalLifePeriodOrganizationResolver must return an array of source-backed LifePeriod organization decisions.",
    );
    error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_RESOLVER_INVALID_OUTPUT";
    throw error;
  }
  const decisions = raw.map((decision) => ({
    ...cloneJson(decision),
    resolver_view_hash: resolverView.resolver_view_hash,
    source: "programmatic_autobiographical_life_period_organization_resolver",
  }));
  return {
    decisions,
    resolver_view: resolverView,
    audit: {
      resolver_used: true,
      input_context_hash: inputHash,
      decision_count: decisions.length,
      current_turn_autobiographical_trigger_required: true,
      overlapping_periods_allowed: true,
      many_to_many_life_event_membership: true,
      temporal_adjacency_alone_used: false,
      calendar_bucket_used: false,
      fixed_duration_threshold_used: false,
      world_state_exposed_to_resolver: false,
      raw_world_event_exposed_to_resolver: false,
      memory_content_exposed_to_resolver: false,
      life_event_content_exposed_to_resolver: false,
      freeform_llm_period_authority_used: false,
      cultural_life_script_assumption_used: false,
      self_model_inference_requested: false,
      belief_revision_requested: false,
      confidence_probability_requested: false,
      world_truth_judgment_requested: false,
    },
  };
}

async function resolveAutobiographicalSelfInterpretationDecisions(
  worldState,
  preparedTurn,
  options,
) {
  const resolver =
    typeof options.autobiographicalSelfInterpretationResolver === "function"
      ? options.autobiographicalSelfInterpretationResolver
      : null;
  const resolverView =
    buildWorldSimulationAutobiographicalSelfInterpretationResolverView({
      world_state: worldState,
      turn_id: preparedTurn.turn_id,
    });
  if (!resolver) {
    return {
      decisions: [],
      resolver_view: resolverView,
      audit: {
        resolver_used: false,
        missing_resolver_means_no_new_interpretation: true,
        current_turn_phase67_trigger_required: true,
        same_character_autobiographical_evidence_only: true,
        explicit_supersession_only: true,
        multiple_active_interpretations_allowed: true,
        max_one_durable_event_per_character_per_turn: true,
        last_write_wins_applied: false,
        mandatory_narrative_coherence_applied: false,
        world_state_exposed_to_resolver: false,
        raw_world_event_exposed_to_resolver: false,
        memory_content_exposed_to_resolver: false,
        hidden_retrieval_graph_exposed_to_resolver: false,
        freeform_life_story_authority_used: false,
        trait_value_preference_role_capability_goal_inference_requested: false,
        self_model_inference_requested: false,
        belief_resolution_requested: false,
        confidence_probability_requested: false,
        world_truth_judgment_requested: false,
      },
    };
  }
  const inputSnapshot = cloneJson(resolverView);
  const inputHash = hashAgentRunValue(inputSnapshot);
  const raw = await resolver(cloneJson(inputSnapshot));
  if (!Array.isArray(raw)) {
    const error = new Error(
      "autobiographicalSelfInterpretationResolver must return an array of source-backed interpretation decisions.",
    );
    error.code =
      "WORLD_SIMULATION_AUTOBIOGRAPHICAL_SELF_INTERPRETATION_RESOLVER_INVALID_OUTPUT";
    throw error;
  }
  const decisions = raw.map((decision) => ({
    ...cloneJson(decision),
    resolver_view_hash: resolverView.resolver_view_hash,
    source: "programmatic_autobiographical_self_interpretation_resolver",
  }));
  return {
    decisions,
    resolver_view: resolverView,
    audit: {
      resolver_used: true,
      input_context_hash: inputHash,
      decision_count: decisions.length,
      current_turn_phase67_trigger_required: true,
      same_character_autobiographical_evidence_only: true,
      explicit_supersession_only: true,
      multiple_active_interpretations_allowed: true,
      max_one_durable_event_per_character_per_turn: true,
      last_write_wins_applied: false,
      mandatory_narrative_coherence_applied: false,
      world_state_exposed_to_resolver: false,
      raw_world_event_exposed_to_resolver: false,
      memory_content_exposed_to_resolver: false,
      hidden_retrieval_graph_exposed_to_resolver: false,
      freeform_life_story_authority_used: false,
      trait_value_preference_role_capability_goal_inference_requested: false,
      self_model_inference_requested: false,
      belief_resolution_requested: false,
      confidence_probability_requested: false,
      world_truth_judgment_requested: false,
    },
  };
}

async function resolveStructuredSelfModelDecisions(
  worldState,
  preparedTurn,
  options,
) {
  const resolver =
    typeof options.structuredSelfModelResolver === "function"
      ? options.structuredSelfModelResolver
      : null;
  const resolverView =
    buildWorldSimulationStructuredSelfModelResolverView({
      world_state: worldState,
      turn_id: preparedTurn.turn_id,
    });
  if (!resolver) {
    return {
      decisions: [],
      resolver_view: resolverView,
      audit: {
        resolver_used: false,
        missing_resolver_means_no_new_aspect: true,
        current_turn_phase68a_trigger_required: true,
        same_character_phase68a_evidence_only: true,
        formation_only: true,
        revision_requested: false,
        world_state_exposed_to_resolver: false,
        raw_world_event_exposed_to_resolver: false,
        raw_memory_content_exposed_to_resolver: false,
        phase67_store_exposed_to_resolver: false,
        hidden_retrieval_graph_exposed_to_resolver: false,
        self_model_accuracy_requested: false,
        self_model_clarity_requested: false,
        confidence_probability_requested: false,
        numeric_personality_capability_scores_requested: false,
        motivation_goal_selection_requested: false,
      },
    };
  }
  const inputSnapshot = cloneJson(resolverView);
  const inputHash = hashAgentRunValue(inputSnapshot);
  const raw = await resolver(cloneJson(inputSnapshot));
  if (!Array.isArray(raw)) {
    const error = new Error(
      "structuredSelfModelResolver must return an array of source-backed aspect formation decisions.",
    );
    error.code = "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_RESOLVER_INVALID_OUTPUT";
    throw error;
  }
  const decisions = raw.map((decision) => ({
    ...cloneJson(decision),
    resolver_view_hash: resolverView.resolver_view_hash,
    source: "programmatic_structured_self_model_resolver",
  }));
  return {
    decisions,
    resolver_view: resolverView,
    audit: {
      resolver_used: true,
      input_context_hash: inputHash,
      decision_count: decisions.length,
      current_turn_phase68a_trigger_required: true,
      same_character_phase68a_evidence_only: true,
      formation_only: true,
      revision_requested: false,
      world_state_exposed_to_resolver: false,
      raw_world_event_exposed_to_resolver: false,
      raw_memory_content_exposed_to_resolver: false,
      phase67_store_exposed_to_resolver: false,
      hidden_retrieval_graph_exposed_to_resolver: false,
      self_model_accuracy_requested: false,
      self_model_clarity_requested: false,
      confidence_probability_requested: false,
      numeric_personality_capability_scores_requested: false,
      motivation_goal_selection_requested: false,
    },
  };
}

async function resolveStructuredSelfModelRevisionDecisions(
  worldState,
  preparedTurn,
  options,
) {
  const resolver =
    typeof options.structuredSelfModelRevisionResolver === "function"
      ? options.structuredSelfModelRevisionResolver
      : null;
  const resolverView =
    buildWorldSimulationStructuredSelfModelRevisionResolverView({
      world_state: worldState,
      turn_id: preparedTurn.turn_id,
    });
  if (!resolver) {
    return {
      decisions: [],
      resolver_view: resolverView,
      audit: {
        resolver_used: false,
        missing_resolver_means_no_new_revision: true,
        current_turn_phase68a_or_phase68b_trigger_required: true,
        same_character_evidence_and_targets_only: true,
        explicit_targets_required: true,
        support_preserves_active_state: true,
        challenge_preserves_active_state: true,
        revise_explicitly_supersedes_targets: true,
        unresolved_challenges_may_coexist: true,
        world_state_exposed_to_resolver: false,
        raw_world_event_exposed_to_resolver: false,
        raw_memory_content_exposed_to_resolver: false,
        phase67_store_exposed_to_resolver: false,
        hidden_retrieval_graph_exposed_to_resolver: false,
        self_model_accuracy_requested: false,
        self_model_clarity_requested: false,
        confidence_probability_requested: false,
        motivation_goal_selection_requested: false,
        world_truth_judgment_requested: false,
      },
    };
  }
  const inputSnapshot = cloneJson(resolverView);
  const inputHash = hashAgentRunValue(inputSnapshot);
  const raw = await resolver(cloneJson(inputSnapshot));
  if (!Array.isArray(raw)) {
    const error = new Error(
      "structuredSelfModelRevisionResolver must return an array of source-backed revision decisions.",
    );
    error.code = "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_REVISION_RESOLVER_INVALID_OUTPUT";
    throw error;
  }
  const decisions = raw.map((decision) => ({
    ...cloneJson(decision),
    resolver_view_hash: resolverView.resolver_view_hash,
    source: "programmatic_structured_self_model_revision_resolver",
  }));
  return {
    decisions,
    resolver_view: resolverView,
    audit: {
      resolver_used: true,
      input_context_hash: inputHash,
      decision_count: decisions.length,
      current_turn_phase68a_or_phase68b_trigger_required: true,
      same_character_evidence_and_targets_only: true,
      explicit_targets_required: true,
      support_preserves_active_state: true,
      challenge_preserves_active_state: true,
      revise_explicitly_supersedes_targets: true,
      unresolved_challenges_may_coexist: true,
      world_state_exposed_to_resolver: false,
      raw_world_event_exposed_to_resolver: false,
      raw_memory_content_exposed_to_resolver: false,
      phase67_store_exposed_to_resolver: false,
      hidden_retrieval_graph_exposed_to_resolver: false,
      self_model_accuracy_requested: false,
      self_model_clarity_requested: false,
      confidence_probability_requested: false,
      motivation_goal_selection_requested: false,
      world_truth_judgment_requested: false,
    },
  };
}

async function resolveImplementationIntentionExecutionFeedbackDecisions(
  priorCommittedWorldState,
  preparedTurn,
  selectedActionIntents,
  actionOutcomes,
  options,
) {
  const resolver =
    typeof options.implementationIntentionExecutionFeedbackResolver === "function"
      ? options.implementationIntentionExecutionFeedbackResolver
      : null;
  const resolverView =
    buildWorldSimulationGoalImplementationIntentionExecutionFeedbackResolverView({
      world_state: priorCommittedWorldState,
      turn_id: preparedTurn.turn_id,
      selected_action_intents: selectedActionIntents,
      action_outcomes: actionOutcomes,
      activation_by_character: {},
    });
  if (!resolver) {
    return {
      decisions: [],
      resolver_view: resolverView,
      audit: {
        resolver_used: false,
        missing_resolver_means_no_execution_feedback: true,
        prior_turn_committed_plan_state_only: true,
        authoritative_action_outcome_evidence_only: true,
        explicit_completion_required: true,
        action_success_implies_plan_completion: false,
        plan_completion_implies_goal_achievement: false,
        goal_achievement_authority_claimed: false,
        action_selection_authority_claimed: false,
        world_state_exposed_to_resolver: false,
        raw_memory_store_exposed_to_resolver: false,
        hidden_retrieval_graph_exposed_to_resolver: false,
        numeric_scoring_requested: false,
      },
    };
  }
  const inputSnapshot = cloneJson(resolverView);
  const inputHash = hashAgentRunValue(inputSnapshot);
  const raw = await resolver(cloneJson(inputSnapshot));
  if (!Array.isArray(raw)) {
    const error = new Error(
      "implementationIntentionExecutionFeedbackResolver must return an array of explicit plan-ref feedback decisions.",
    );
    error.code =
      "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_EXECUTION_FEEDBACK_RESOLVER_INVALID_OUTPUT";
    throw error;
  }
  const decisions = raw.map((decision) => ({
    ...cloneJson(decision),
    source: "programmatic_implementation_intention_execution_feedback_resolver",
  }));
  return {
    decisions,
    resolver_view: resolverView,
    audit: {
      resolver_used: true,
      input_context_hash: inputHash,
      decision_count: decisions.length,
      prior_turn_committed_plan_state_only: true,
      authoritative_action_outcome_evidence_only: true,
      explicit_completion_required: true,
      action_success_implies_plan_completion: false,
      plan_completion_implies_goal_achievement: false,
      goal_achievement_authority_claimed: false,
      action_selection_authority_claimed: false,
      world_state_exposed_to_resolver: false,
      raw_memory_store_exposed_to_resolver: false,
      hidden_retrieval_graph_exposed_to_resolver: false,
      numeric_scoring_requested: false,
    },
  };
}

async function resolveGoalAchievementDecisions(
  priorCommittedWorldState,
  preparedTurn,
  causalResolution,
  options,
) {
  const resolver =
    typeof options.goalAchievementResolver === "function"
      ? options.goalAchievementResolver
      : null;
  const resolverView = buildWorldSimulationGoalAchievementResolverView({
    world_state: priorCommittedWorldState,
    turn_id: preparedTurn.turn_id,
    state_transitions: array(causalResolution.state_transitions),
    action_outcomes: array(causalResolution.action_outcomes),
    knowledge_transitions: array(causalResolution.knowledge_transitions),
  });
  if (!resolver) {
    return {
      decisions: [],
      resolver_view: resolverView,
      audit: {
        resolver_used: false,
        missing_resolver_means_no_goal_achievement: true,
        prior_turn_committed_goal_state_only: true,
        authoritative_current_turn_evidence_only: true,
        explicit_goal_condition_verification_required: true,
        action_success_implies_goal_achievement: false,
        plan_fulfillment_implies_goal_achievement: false,
        plan_completion_implies_goal_achievement: false,
        failure_or_unattainability_requested: false,
        world_state_exposed_to_resolver: false,
        raw_memory_store_exposed_to_resolver: false,
        hidden_retrieval_graph_exposed_to_resolver: false,
        numeric_scoring_requested: false,
        replanning_requested: false,
      },
    };
  }
  const inputSnapshot = cloneJson(resolverView);
  const inputHash = hashAgentRunValue(inputSnapshot);
  const raw = await resolver(cloneJson(inputSnapshot));
  if (!Array.isArray(raw)) {
    const error = new Error(
      "goalAchievementResolver must return an array of explicit goal-ref achievement decisions.",
    );
    error.code = "WORLD_SIMULATION_GOAL_ACHIEVEMENT_RESOLVER_INVALID_OUTPUT";
    throw error;
  }
  const decisions = raw.map((decision) => ({
    ...cloneJson(decision),
    source: "programmatic_goal_achievement_resolver",
  }));
  return {
    decisions,
    resolver_view: resolverView,
    audit: {
      resolver_used: true,
      input_context_hash: inputHash,
      decision_count: decisions.length,
      prior_turn_committed_goal_state_only: true,
      authoritative_current_turn_evidence_only: true,
      explicit_goal_condition_verification_required: true,
      action_success_implies_goal_achievement: false,
      plan_fulfillment_implies_goal_achievement: false,
      plan_completion_implies_goal_achievement: false,
      failure_or_unattainability_requested: false,
      world_state_exposed_to_resolver: false,
      raw_memory_store_exposed_to_resolver: false,
      hidden_retrieval_graph_exposed_to_resolver: false,
      numeric_scoring_requested: false,
      replanning_requested: false,
    },
  };
}

async function resolveGoalViabilityDecisions(
  priorCommittedWorldState,
  preparedTurn,
  causalResolution,
  options,
) {
  const resolver =
    typeof options.goalViabilityResolver === "function"
      ? options.goalViabilityResolver
      : null;
  const resolverView = buildWorldSimulationGoalViabilityResolverView({
    world_state: priorCommittedWorldState,
    turn_id: preparedTurn.turn_id,
    state_transitions: array(causalResolution.state_transitions),
    action_outcomes: array(causalResolution.action_outcomes),
    knowledge_transitions: array(causalResolution.knowledge_transitions),
  });
  if (!resolver) {
    return {
      decisions: [],
      resolver_view: resolverView,
      audit: {
        resolver_used: false,
        missing_resolver_means_no_goal_unattainability: true,
        prior_turn_committed_goal_state_only: true,
        authoritative_current_turn_evidence_only: true,
        explicit_unattainability_verification_required: true,
        structural_authoritative_evidence_required: true,
        action_outcome_only_sufficient: false,
        action_failure_alone_sufficient: false,
        plan_failure_alone_sufficient: false,
        lack_of_progress_alone_sufficient: false,
        automatic_abandonment_requested: false,
        automatic_disengagement_requested: false,
        automatic_reengagement_requested: false,
        autonomous_replanning_requested: false,
        world_state_exposed_to_resolver: false,
        raw_memory_store_exposed_to_resolver: false,
        hidden_retrieval_graph_exposed_to_resolver: false,
        numeric_scoring_requested: false,
      },
    };
  }
  const inputSnapshot = cloneJson(resolverView);
  const inputHash = hashAgentRunValue(inputSnapshot);
  const raw = await resolver(cloneJson(inputSnapshot));
  if (!Array.isArray(raw)) {
    const error = new Error(
      "goalViabilityResolver must return an array of explicit goal-ref unattainability decisions.",
    );
    error.code = "WORLD_SIMULATION_GOAL_UNATTAINABILITY_RESOLVER_INVALID_OUTPUT";
    throw error;
  }
  const decisions = raw.map((decision) => ({
    ...cloneJson(decision),
    source: "programmatic_goal_viability_resolver",
  }));
  return {
    decisions,
    resolver_view: resolverView,
    audit: {
      resolver_used: true,
      input_context_hash: inputHash,
      decision_count: decisions.length,
      prior_turn_committed_goal_state_only: true,
      authoritative_current_turn_evidence_only: true,
      explicit_unattainability_verification_required: true,
      structural_authoritative_evidence_required: true,
      action_outcome_only_sufficient: false,
      action_failure_alone_sufficient: false,
      plan_failure_alone_sufficient: false,
      lack_of_progress_alone_sufficient: false,
      automatic_abandonment_requested: false,
      automatic_disengagement_requested: false,
      automatic_reengagement_requested: false,
      autonomous_replanning_requested: false,
      world_state_exposed_to_resolver: false,
      raw_memory_store_exposed_to_resolver: false,
      hidden_retrieval_graph_exposed_to_resolver: false,
      numeric_scoring_requested: false,
    },
  };
}

async function resolveGoalAdjustmentDecisions(
  priorCommittedWorldState,
  preparedTurn,
  options,
) {
  const resolver =
    typeof options.goalAdjustmentResolver === "function"
      ? options.goalAdjustmentResolver
      : null;
  const resolverView = buildWorldSimulationGoalAdjustmentResolverView({
    world_state: priorCommittedWorldState,
    turn_id: preparedTurn.turn_id,
  });
  if (!resolver) {
    return {
      decisions: [],
      resolver_view: resolverView,
      audit: {
        resolver_used: false,
        missing_resolver_means_no_goal_adjustment: true,
        prior_turn_committed_goal_state_only: true,
        phase70b_unattainability_required_for_disengagement: true,
        unattainability_implies_disengagement: false,
        action_failure_implies_disengagement: false,
        plan_failure_implies_disengagement: false,
        lack_of_progress_implies_disengagement: false,
        reengagement_requires_prior_committed_disengagement: true,
        same_turn_disengage_reengage_allowed: false,
        same_goal_reengagement_allowed: false,
        alternative_goal_must_already_be_committed: true,
        new_goal_creation_requested: false,
        goal_commitment_creation_requested: false,
        replanning_requested: false,
        world_state_exposed_to_resolver: false,
        raw_memory_store_exposed_to_resolver: false,
        hidden_retrieval_graph_exposed_to_resolver: false,
        implementation_plan_internals_exposed_to_resolver: false,
        numeric_scoring_requested: false,
      },
    };
  }
  const inputSnapshot = cloneJson(resolverView);
  const inputHash = hashAgentRunValue(inputSnapshot);
  const raw = await resolver(cloneJson(inputSnapshot));
  if (!Array.isArray(raw)) {
    const error = new Error(
      "goalAdjustmentResolver must return an array of explicit source-goal adjustment decisions.",
    );
    error.code = "WORLD_SIMULATION_GOAL_ADJUSTMENT_RESOLVER_INVALID_OUTPUT";
    throw error;
  }
  const decisions = raw.map((decision) => ({
    ...cloneJson(decision),
    source: "programmatic_goal_adjustment_resolver",
  }));
  return {
    decisions,
    resolver_view: resolverView,
    audit: {
      resolver_used: true,
      input_context_hash: inputHash,
      decision_count: decisions.length,
      prior_turn_committed_goal_state_only: true,
      phase70b_unattainability_required_for_disengagement: true,
      unattainability_implies_disengagement: false,
      action_failure_implies_disengagement: false,
      plan_failure_implies_disengagement: false,
      lack_of_progress_implies_disengagement: false,
      reengagement_requires_prior_committed_disengagement: true,
      same_turn_disengage_reengage_allowed: false,
      same_goal_reengagement_allowed: false,
      alternative_goal_must_already_be_committed: true,
      new_goal_creation_requested: false,
      goal_commitment_creation_requested: false,
      replanning_requested: false,
      world_state_exposed_to_resolver: false,
      raw_memory_store_exposed_to_resolver: false,
      hidden_retrieval_graph_exposed_to_resolver: false,
      implementation_plan_internals_exposed_to_resolver: false,
      numeric_scoring_requested: false,
    },
  };
}

async function resolveAdaptiveReplanningDecisions(
  priorCommittedWorldState,
  preparedTurn,
  options,
) {
  const sourceView = buildWorldSimulationAdaptiveReplanningResolverView({
    world_state: priorCommittedWorldState,
    turn_id: preparedTurn.turn_id,
    alternative_means_candidates: [],
  });
  const provider = typeof options.adaptiveReplanningCandidateProvider === "function"
    ? options.adaptiveReplanningCandidateProvider
    : null;
  let rawCandidates = [];
  let providerInputHash = null;
  if (provider && sourceView.eligible_source_plans.length > 0) {
    const providerInput = cloneJson(sourceView);
    providerInputHash = hashAgentRunValue(providerInput);
    const provided = await provider(cloneJson(providerInput));
    if (!Array.isArray(provided)) {
      const error = new Error(
        "adaptiveReplanningCandidateProvider must return an array of bounded alternative-means candidates.",
      );
      error.code = "WORLD_SIMULATION_ADAPTIVE_REPLANNING_CANDIDATE_PROVIDER_INVALID_OUTPUT";
      throw error;
    }
    rawCandidates = cloneJson(provided);
  }
  const resolverView = buildWorldSimulationAdaptiveReplanningResolverView({
    world_state: priorCommittedWorldState,
    turn_id: preparedTurn.turn_id,
    alternative_means_candidates: rawCandidates,
  });
  const resolver = typeof options.adaptiveReplanningResolver === "function"
    ? options.adaptiveReplanningResolver
    : null;
  if (!resolver || resolverView.alternative_means_candidates.length === 0) {
    return {
      decisions: [],
      resolver_view: resolverView,
      audit: {
        provider_used: Boolean(provider),
        resolver_used: false,
        provider_input_context_hash: providerInputHash,
        missing_provider_or_resolver_means_no_adaptive_replanning: true,
        prior_turn_committed_failure_evidence_only: true,
        minimum_consecutive_failure_turns: 2,
        single_action_failure_sufficient: false,
        single_plan_failure_event_sufficient: false,
        same_goal_preserved: true,
        bounded_character_means_grounding_catalog_exposed_to_provider: true,
        candidate_character_cognition_grounding_required: true,
        replace_means_requires_grounding_beyond_failed_current_means: true,
        provider_arbitrary_world_state_search_available: false,
        world_state_exposed_to_provider_or_resolver: false,
        raw_memory_store_exposed_to_provider_or_resolver: false,
        hidden_retrieval_graph_exposed_to_provider_or_resolver: false,
        numeric_scoring_requested: false,
      },
    };
  }
  const resolverInput = cloneJson(resolverView);
  const resolverInputHash = hashAgentRunValue(resolverInput);
  const raw = await resolver(cloneJson(resolverInput));
  if (!Array.isArray(raw)) {
    const error = new Error(
      "adaptiveReplanningResolver must return an array of source-plan/candidate-ref selections.",
    );
    error.code = "WORLD_SIMULATION_ADAPTIVE_REPLANNING_RESOLVER_INVALID_OUTPUT";
    throw error;
  }
  const decisions = raw.map((decision) => ({
    source_plan_ref: decision?.source_plan_ref,
    candidate_ref: decision?.candidate_ref,
  }));
  return {
    decisions,
    resolver_view: resolverView,
    audit: {
      provider_used: Boolean(provider),
      resolver_used: true,
      provider_input_context_hash: providerInputHash,
      resolver_input_context_hash: resolverInputHash,
      candidate_count: resolverView.alternative_means_candidates.length,
      decision_count: decisions.length,
      prior_turn_committed_failure_evidence_only: true,
      minimum_consecutive_failure_turns: 2,
      single_action_failure_sufficient: false,
      single_plan_failure_event_sufficient: false,
      same_goal_preserved: true,
      bounded_character_means_grounding_catalog_exposed_to_provider: true,
      candidate_character_cognition_grounding_required: true,
      replace_means_requires_grounding_beyond_failed_current_means: true,
      provider_arbitrary_world_state_search_available: false,
      world_state_exposed_to_provider_or_resolver: false,
      raw_memory_store_exposed_to_provider_or_resolver: false,
      hidden_retrieval_graph_exposed_to_provider_or_resolver: false,
      numeric_scoring_requested: false,
    },
  };
}

async function resolveMeansFeasibilityDecisions(
  worldState,
  preparedTurn,
  selectedActionIntents,
  causalResolution,
  options,
) {
  const resolverView = buildWorldSimulationMeansFeasibilityResolverView({
    world_state: worldState,
    turn_id: preparedTurn.turn_id,
    selected_action_intents: selectedActionIntents,
    action_outcomes: array(causalResolution.action_outcomes),
    state_transitions: array(causalResolution.state_transitions),
  });
  const evaluator = typeof options.meansFeasibilityEvaluator === "function"
    ? options.meansFeasibilityEvaluator
    : null;
  if (!evaluator || resolverView.source_plans.length === 0) {
    return {
      decisions: [],
      resolver_view: resolverView,
      audit: {
        evaluator_used: false,
        missing_evaluator_or_source_means_no_feasibility_event: true,
        post_phase71_effective_plan_state_used: true,
        bounded_current_turn_engine_evidence_catalog_only: true,
        physical_executability_required_to_claim_feasible: true,
        raw_world_state_exposed_to_evaluator: false,
        raw_memory_store_exposed_to_evaluator: false,
        hidden_retrieval_graph_exposed_to_evaluator: false,
        alternative_means_generation_requested: false,
        goal_state_mutation_requested: false,
        plan_lifecycle_mutation_requested: false,
        same_turn_replanning_requested: false,
        character_knowledge_update_requested: false,
        numeric_scoring_requested: false,
      },
    };
  }
  const inputSnapshot = cloneJson(resolverView);
  const inputHash = hashAgentRunValue(inputSnapshot);
  const raw = await evaluator(cloneJson(inputSnapshot));
  if (!Array.isArray(raw)) {
    const error = new Error(
      "meansFeasibilityEvaluator must return an array of explicit source-plan constraint decisions.",
    );
    error.code = "WORLD_SIMULATION_MEANS_FEASIBILITY_EVALUATOR_INVALID_OUTPUT";
    throw error;
  }
  return {
    decisions: cloneJson(raw),
    resolver_view: resolverView,
    audit: {
      evaluator_used: true,
      input_context_hash: inputHash,
      source_plan_count: resolverView.source_plans.length,
      authoritative_evidence_count: resolverView.authoritative_evidence.length,
      decision_count: raw.length,
      post_phase71_effective_plan_state_used: true,
      bounded_current_turn_engine_evidence_catalog_only: true,
      complete_coverage_required_to_claim_feasible: true,
      physical_executability_required_to_claim_feasible: true,
      physical_executability_separate_from_authorization: true,
      character_visible_evidence_explicit_subset_only: true,
      raw_world_state_exposed_to_evaluator: false,
      raw_memory_store_exposed_to_evaluator: false,
      hidden_retrieval_graph_exposed_to_evaluator: false,
      alternative_means_generation_requested: false,
      goal_state_mutation_requested: false,
      plan_lifecycle_mutation_requested: false,
      same_turn_replanning_requested: false,
      character_knowledge_update_requested: false,
      numeric_scoring_requested: false,
    },
  };
}

async function resolveExperienceGroundedSubjectiveLearningInterpretations(
  worldState,
  preparedTurn,
  sourceMemoryRecords,
  phase76bMemoryBridge,
  options,
) {
  const resolverView =
    buildWorldSimulationExperienceGroundedSubjectiveLearningResolverView({
      world_state: worldState,
      turn_id: preparedTurn.turn_id,
      source_memory_records: sourceMemoryRecords,
      phase76b_memory_bridge: phase76bMemoryBridge,
    });
  const interpreter =
    typeof options.experienceGroundedSubjectiveLearningInterpreter === "function"
      ? options.experienceGroundedSubjectiveLearningInterpreter
      : null;
  let rawDecisions = [];
  let inputHash = null;
  if (interpreter && resolverView.character_contexts.length > 0) {
    const inputSnapshot = cloneJson(resolverView);
    inputHash = hashAgentRunValue(inputSnapshot);
    const raw = await interpreter(cloneJson(inputSnapshot));
    if (!Array.isArray(raw)) {
      const error = new Error(
        "experienceGroundedSubjectiveLearningInterpreter must return an array of bounded single-experience learning interpretations.",
      );
      error.code =
        "WORLD_SIMULATION_EXPERIENCE_GROUNDED_LEARNING_INTERPRETER_INVALID_OUTPUT";
      throw error;
    }
    rawDecisions = cloneJson(raw);
  }
  const built =
    buildWorldSimulationExperienceGroundedSubjectiveLearningClaimProposals({
      resolver_view: resolverView,
      interpretation_decisions: rawDecisions,
    });
  return {
    ...built,
    resolver_view: resolverView,
    audit: {
      ...cloneJson(built.audit),
      interpreter_used: Boolean(interpreter && resolverView.character_contexts.length > 0),
      input_context_hash: inputHash,
      eligible_character_count: resolverView.character_contexts.length,
      eligible_experience_memory_count: resolverView.character_contexts
        .reduce((sum, context) => sum + array(context.experiences).length, 0),
      missing_interpreter_means_no_automatic_learning_claim: !interpreter,
      same_turn_character_brain_consumes_new_learning: false,
    },
  };
}

async function resolveSubjectiveMeansFeasibilityInterpretations(
  worldState,
  preparedTurn,
  sourceMemoryRecords,
  options,
) {
  const resolverView =
    buildWorldSimulationSubjectiveMeansFeasibilityResolverView({
      world_state: worldState,
      turn_id: preparedTurn.turn_id,
      source_memory_records: sourceMemoryRecords,
      phase73a_observation_projections:
        preparedTurn.visible_constraint_observation_projections ?? [],
    });
  const interpreter =
    typeof options.subjectiveMeansFeasibilityInterpreter === "function"
      ? options.subjectiveMeansFeasibilityInterpreter
      : null;
  let rawDecisions = [];
  let inputHash = null;
  if (interpreter && resolverView.character_contexts.length > 0) {
    const inputSnapshot = cloneJson(resolverView);
    inputHash = hashAgentRunValue(inputSnapshot);
    const raw = await interpreter(cloneJson(inputSnapshot));
    if (!Array.isArray(raw)) {
      const error = new Error(
        "subjectiveMeansFeasibilityInterpreter must return an array of bounded subjective feasibility interpretations.",
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_MEANS_FEASIBILITY_INTERPRETER_INVALID_OUTPUT";
      throw error;
    }
    rawDecisions = cloneJson(raw);
  }
  const built =
    buildWorldSimulationSubjectiveMeansFeasibilityClaimProposals({
      resolver_view: resolverView,
      interpretation_decisions: rawDecisions,
    });
  return {
    ...built,
    resolver_view: resolverView,
    audit: {
      ...cloneJson(built.audit),
      interpreter_used: Boolean(interpreter && resolverView.character_contexts.length > 0),
      input_context_hash: inputHash,
      eligible_character_count: resolverView.character_contexts.length,
      eligible_constraint_memory_count: resolverView.character_contexts
        .reduce((sum, context) => sum + array(context.constraint_memories).length, 0),
      missing_interpreter_means_no_automatic_constraint_claim: !interpreter,
      same_turn_phase71_consumes_new_interpretation: false,
    },
  };
}

async function resolveSubjectiveClaimProposals(
  worldState,
  preparedTurn,
  sourceMemoryRecords,
  options,
) {
  const resolver =
    typeof options.subjectiveClaimResolver === "function"
      ? options.subjectiveClaimResolver
      : null;

  const resolverView =
    buildWorldSimulationSubjectiveClaimResolverView({
      world_state:
        worldState,
      turn_id:
        preparedTurn.turn_id,
      source_memory_records:
        sourceMemoryRecords,
    });

  if (!resolver) {
    return {
      proposals: [],
      resolver_view:
        resolverView,
      audit: {
        resolver_used:
          false,
        missing_resolver_means_no_new_claims:
          true,
        current_turn_new_subjective_memories_only:
          true,
        world_state_exposed_to_resolver:
          false,
        raw_world_event_exposed_to_resolver:
          false,
        whole_memory_store_exposed_to_resolver:
          false,
        internal_memory_provenance_exposed_to_resolver:
          false,
        retrieval_history_exposed_to_resolver:
          false,
        memory_plasticity_history_exposed_to_resolver:
          false,
        confidence_probability_requested:
          false,
        world_truth_judgment_requested:
          false,
      },
    };
  }

  const inputSnapshot =
    cloneJson(
      resolverView,
    );

  const inputHash =
    hashAgentRunValue(
      inputSnapshot,
    );

  const raw =
    await resolver(
      cloneJson(inputSnapshot),
    );

  if (!Array.isArray(raw)) {
    const error = new Error(
      "subjectiveClaimResolver must return an array of evidence-backed claim proposals.",
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_CLAIM_RESOLVER_INVALID_OUTPUT";
    throw error;
  }

  return {
    proposals:
      cloneJson(raw),
    resolver_view:
      resolverView,
    audit: {
      resolver_used:
        true,
      input_context_hash:
        inputHash,
      proposal_count:
        raw.length,
      current_turn_new_subjective_memories_only:
        true,
      world_state_exposed_to_resolver:
        false,
      raw_world_event_exposed_to_resolver:
        false,
      whole_memory_store_exposed_to_resolver:
        false,
      internal_memory_provenance_exposed_to_resolver:
        false,
      retrieval_history_exposed_to_resolver:
        false,
      memory_plasticity_history_exposed_to_resolver:
        false,
      confidence_probability_requested:
        false,
      world_truth_judgment_requested:
        false,
    },
  };
}

async function resolveSubjectiveClaimRelationProposals(
  worldState,
  preparedTurn,
  options,
) {
  const resolver =
    typeof options.subjectiveClaimRelationResolver === "function"
      ? options.subjectiveClaimRelationResolver
      : null;

  const resolverView =
    buildWorldSimulationSubjectiveClaimConflictRevisionResolverView({
      world_state:
        worldState,
      turn_id:
        preparedTurn.turn_id,
    });

  if (!resolver) {
    return {
      proposals: [],
      resolver_view:
        resolverView,
      audit: {
        resolver_used:
          false,
        missing_resolver_means_no_new_relations:
          true,
        current_turn_claim_must_anchor_relation:
          true,
        world_state_exposed_to_resolver:
          false,
        raw_world_event_exposed_to_resolver:
          false,
        memory_content_exposed_to_resolver:
          false,
        retrieval_history_exposed_to_resolver:
          false,
        memory_plasticity_history_exposed_to_resolver:
          false,
        confidence_probability_requested:
          false,
        world_truth_judgment_requested:
          false,
        target_claim_mutation_requested:
          false,
      },
    };
  }

  const inputSnapshot =
    cloneJson(
      resolverView,
    );
  const inputHash =
    hashAgentRunValue(
      inputSnapshot,
    );
  const raw =
    await resolver(
      cloneJson(inputSnapshot),
    );

  if (!Array.isArray(raw)) {
    const error = new Error(
      "subjectiveClaimRelationResolver must return an array of candidate claim-to-claim relations.",
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_CLAIM_RELATION_RESOLVER_INVALID_OUTPUT";
    throw error;
  }

  return {
    proposals:
      cloneJson(raw),
    resolver_view:
      resolverView,
    audit: {
      resolver_used:
        true,
      input_context_hash:
        inputHash,
      proposal_count:
        raw.length,
      current_turn_claim_must_anchor_relation:
        true,
      world_state_exposed_to_resolver:
        false,
      raw_world_event_exposed_to_resolver:
        false,
      memory_content_exposed_to_resolver:
        false,
      retrieval_history_exposed_to_resolver:
        false,
      memory_plasticity_history_exposed_to_resolver:
        false,
      confidence_probability_requested:
        false,
      world_truth_judgment_requested:
        false,
      target_claim_mutation_requested:
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

  const subjectiveChoiceCommitmentReceipts =
    buildWorldSimulationSubjectiveChoiceCommitmentReceipts({
      world_simulation_session_id: sessionId,
      turn_id: preparedTurn.turn_id,
      state_revision: snapshot.revision,
      world_state_hash: snapshot.state_hash,
      decision_packets: preparedTurn.decision_packets,
      selected_action_intents: selected,
    });

  // Phase76F closes the pre-outcome provenance chain only after the Character
  // Brain has made a canonical Phase74D choice. A receipt is created only when
  // the selected action_ref already had an explicit method->candidate
  // attribution in the prepared turn. This still says nothing about whether
  // the method caused the choice or whether the eventual action succeeds.
  const selectedExperientialMethodApplicationReceipts =
    buildWorldSimulationSelectedExperientialMethodApplicationReceipts({
      world_simulation_session_id: sessionId,
      turn_id: preparedTurn.turn_id,
      state_revision: snapshot.revision,
      world_state_hash: snapshot.state_hash,
      candidate_attribution_projections:
        preparedTurn.experiential_method_candidate_attribution_projections ?? [],
      subjective_choice_commitment_receipts:
        subjectiveChoiceCommitmentReceipts,
    });

  // Phase79G records only the exact provenance edge between a canonical
  // Phase79F or Phase79J resolved dominant experiential method and a Phase76F
  // selected application that actually contains that same transfer ref. A
  // Phase79J edge also preserves its exact unresolved Phase79F ancestor instead
  // of pretending that ancestor resolved the impasse. This is pre-outcome
  // lineage: it neither claims that re-resolution caused the Character's choice
  // nor consumes causal outcome evidence, and it is persisted only with the
  // final successful atomic world-turn commit below.
  const experientialMethodImpasseResolutionApplicationLineage =
    buildWorldSimulationExperientialMethodImpasseResolutionApplicationLineage({
      world_simulation_session_id: sessionId,
      turn_id: preparedTurn.turn_id,
      state_revision: snapshot.revision,
      world_state_hash: snapshot.state_hash,
      impasse_reresolution_projections:
        preparedTurn.experiential_method_impasse_reresolution_projections ?? [],
      impasse_precedent_reresolution_projections:
        preparedTurn.experiential_method_impasse_precedent_reresolution_projections ?? [],
      selected_application_receipts:
        selectedExperientialMethodApplicationReceipts,
    });

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

  // Phase76A is computed as soon as the authoritative causal resolution has
  // passed the hard consistency gate. It remains speculative evidence until
  // the atomic world commit succeeds below.
  const postOutcomeSubjectivePerceptionProjection =
    projectWorldSimulationPostOutcomeSubjectivePerception({
      turn_id: preparedTurn.turn_id,
      selected_action_intents: selected,
      action_outcomes: array(causalResolution.action_outcomes),
      state_transitions: array(causalResolution.state_transitions),
    });

  // Phase76B consumes only the already-bounded Phase76A projection plus the
  // acting character's own selected intent. It does not receive raw outcomes,
  // state transitions, or World State and cannot write memory or belief itself.
  const postOutcomeSubjectiveMemoryBridge =
    bridgeWorldSimulationPostOutcomeSubjectiveExperienceToMemory({
      turn_id: preparedTurn.turn_id,
      selected_action_intents: selected,
      post_outcome_subjective_perception_projection:
        postOutcomeSubjectivePerceptionProjection,
    });

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

  const subjectiveMemoryPlasticitySourceEventIds = [
    ...subjectiveMemoryRetrievalPersistence
      .result
      .retrieval_events_created
      .map((retrievalEvent) => retrievalEvent.retrieval_event_id),
    ...subjectiveMemoryRetrievalPersistence
      .result
      .already_persisted_retrieval_event_ids,
  ];

  const subjectiveMemoryPlasticity =
    buildWorldSimulationMemoryPlasticity({
      world_state:
        retrievalPersistedWorldState,
      retrieval_event_ids:
        subjectiveMemoryPlasticitySourceEventIds,
    });

  const subjectiveMemoryPlasticityMutationQueue =
    buildWorldSimulationChronologicalMutationQueue({
      turn_id:
        `${preparedTurn.turn_id}:memory_plasticity`,
      world_state_hash:
        hashAgentRunValue(
          retrievalPersistedWorldState,
        ),
      state_transitions:
        subjectiveMemoryPlasticity
          .result
          .state_transitions,
      elapsed_ms: 0,
    });

  const subjectiveMemoryPlasticityMutationExecution =
    executeWorldSimulationChronologicalMutationQueue({
      world_state:
        retrievalPersistedWorldState,
      preview_world_state:
        subjectiveMemoryPlasticity
          .result
          .preview_world_state,
      queue:
        subjectiveMemoryPlasticityMutationQueue,
      scene_id:
        preparedTurn.event?.scene_id
        ?? preparedTurn.event?.location_id
        ?? null,
    });

  const plasticityPersistedWorldState =
    subjectiveMemoryPlasticityMutationExecution
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
        plasticityPersistedWorldState,

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
    plasticityPersistedWorldState,
    subjectiveMemoryFormation.result,
  );
  const subjectiveMemoryMutationQueue = buildWorldSimulationChronologicalMutationQueue({
    turn_id: `${preparedTurn.turn_id}:subjective_memory`,
    world_state_hash: hashAgentRunValue(plasticityPersistedWorldState),
    state_transitions: subjectiveMemoryFormation.result.memory_transitions,
    elapsed_ms: 0,
  });
  const subjectiveMemoryMutationExecution = executeWorldSimulationChronologicalMutationQueue({
    world_state: plasticityPersistedWorldState,
    preview_world_state: subjectiveMemoryPreview,
    queue: subjectiveMemoryMutationQueue,
    scene_id: preparedTurn.event?.scene_id ?? preparedTurn.event?.location_id ?? null,
  });

  // Phase76B uses the same sealed Phase63 formation semantics, but in a second
  // bounded pass after the ordinary pre-action perception memories have been
  // applied. The source packet contains only Phase76A subjective experience.
  const postOutcomeSubjectiveMemoryFormation =
    formWorldSimulationSubjectiveMemories({
      world_state:
        subjectiveMemoryMutationExecution.next_world_state,
      turn_id:
        preparedTurn.turn_id,
      event:
        preparedTurn.event,
      decision_packets:
        postOutcomeSubjectiveMemoryBridge.memory_formation_packets,
      encoding_decisions: [],
      episode_bindings: [],
    });

  const postOutcomeSubjectiveMemoryPreview =
    applySubjectiveMemoryPreview(
      subjectiveMemoryMutationExecution.next_world_state,
      postOutcomeSubjectiveMemoryFormation.result,
    );

  const postOutcomeSubjectiveMemoryMutationQueue =
    buildWorldSimulationChronologicalMutationQueue({
      turn_id:
        `${preparedTurn.turn_id}:post_outcome_subjective_memory`,
      world_state_hash:
        hashAgentRunValue(
          subjectiveMemoryMutationExecution.next_world_state,
        ),
      state_transitions:
        postOutcomeSubjectiveMemoryFormation.result.memory_transitions,
      elapsed_ms: 0,
    });

  const postOutcomeSubjectiveMemoryMutationExecution =
    executeWorldSimulationChronologicalMutationQueue({
      world_state:
        subjectiveMemoryMutationExecution.next_world_state,
      preview_world_state:
        postOutcomeSubjectiveMemoryPreview,
      queue:
        postOutcomeSubjectiveMemoryMutationQueue,
      scene_id:
        preparedTurn.event?.scene_id
        ?? preparedTurn.event?.location_id
        ?? null,
    });

  const subjectiveClaimSourceMemories = [
    ...subjectiveClaimSourceMemoryRecords(
      subjectiveMemoryFormation,
    ),
    ...subjectiveClaimSourceMemoryRecords(
      postOutcomeSubjectiveMemoryFormation,
    ),
  ];

  const subjectiveEpisodeSegmentation =
    buildWorldSimulationSubjectiveEpisodeSegmentations({
      world_state:
        postOutcomeSubjectiveMemoryMutationExecution.next_world_state,
      turn_id:
        preparedTurn.turn_id,
      source_memory_records:
        subjectiveClaimSourceMemories,
    });

  const subjectiveEpisodeSegmentationMutationQueue =
    buildWorldSimulationChronologicalMutationQueue({
      turn_id:
        `${preparedTurn.turn_id}:subjective_episode_segmentation`,
      world_state_hash:
        hashAgentRunValue(
          postOutcomeSubjectiveMemoryMutationExecution.next_world_state,
        ),
      state_transitions:
        subjectiveEpisodeSegmentation
          .result
          .state_transitions,
      elapsed_ms: 0,
    });

  const subjectiveEpisodeSegmentationMutationExecution =
    executeWorldSimulationChronologicalMutationQueue({
      world_state:
        postOutcomeSubjectiveMemoryMutationExecution.next_world_state,
      preview_world_state:
        subjectiveEpisodeSegmentation
          .result
          .preview_world_state,
      queue:
        subjectiveEpisodeSegmentationMutationQueue,
      scene_id:
        preparedTurn.event?.scene_id
        ?? preparedTurn.event?.location_id
        ?? null,
    });

  const autobiographicalLifeEventSourceSegmentationEventIds = [
    ...subjectiveEpisodeSegmentation
      .result
      .segmentation_events_created
      .map((event) => event.segmentation_event_id),
    ...subjectiveEpisodeSegmentation
      .result
      .already_persisted_segmentation_event_ids,
  ];

  const autobiographicalLifeEventOrganizationDecisionResolution =
    await resolveAutobiographicalLifeEventOrganizationDecisions(
      subjectiveEpisodeSegmentationMutationExecution.next_world_state,
      preparedTurn,
      autobiographicalLifeEventSourceSegmentationEventIds,
      options,
    );

  const autobiographicalLifeEventOrganization =
    buildWorldSimulationAutobiographicalLifeEventOrganizations({
      world_state:
        subjectiveEpisodeSegmentationMutationExecution.next_world_state,
      turn_id:
        preparedTurn.turn_id,
      source_segmentation_event_ids:
        autobiographicalLifeEventSourceSegmentationEventIds,
      organization_decisions:
        autobiographicalLifeEventOrganizationDecisionResolution.decisions,
      resolver_view_hash:
        autobiographicalLifeEventOrganizationDecisionResolution
          .resolver_view
          .resolver_view_hash,
    });

  const autobiographicalLifeEventOrganizationMutationQueue =
    buildWorldSimulationChronologicalMutationQueue({
      turn_id:
        `${preparedTurn.turn_id}:autobiographical_life_event`,
      world_state_hash:
        hashAgentRunValue(
          subjectiveEpisodeSegmentationMutationExecution.next_world_state,
        ),
      state_transitions:
        autobiographicalLifeEventOrganization
          .result
          .state_transitions,
      elapsed_ms: 0,
    });

  const autobiographicalLifeEventOrganizationMutationExecution =
    executeWorldSimulationChronologicalMutationQueue({
      world_state:
        subjectiveEpisodeSegmentationMutationExecution.next_world_state,
      preview_world_state:
        autobiographicalLifeEventOrganization
          .result
          .preview_world_state,
      queue:
        autobiographicalLifeEventOrganizationMutationQueue,
      scene_id:
        preparedTurn.event?.scene_id
        ?? preparedTurn.event?.location_id
        ?? null,
    });

  const personalSemanticSourceOrganizationEventIds =
    autobiographicalLifeEventOrganization
      .result
      .organization_events_created
      .map((event) => event.organization_event_id);

  // Phase77A assembles bounded same-character multi-LifeEvent evidence after
  // canonical Phase67B organization is materialized, but before Phase67C owns
  // any durable semantic decision. It preserves episode specificity, exposes
  // only subjective post-outcome action experience to the future aligner, and
  // never promotes recurrence count into a schema on its own.
  const multiExperienceSchemaEvidence =
    buildWorldSimulationMultiExperienceSchemaEvidenceView({
      world_state:
        autobiographicalLifeEventOrganizationMutationExecution.next_world_state,
      turn_id:
        preparedTurn.turn_id,
      source_organization_event_ids:
        personalSemanticSourceOrganizationEventIds,
    });

  // Phase77B performs bounded relational alignment over the exact Phase77A
  // projection. The resolver may author only a reviewable schema descriptor and
  // must ground every selected case in both action and perceived result. No
  // proposal is promoted into durable personal semantic memory in this phase.
  const relationalSchemaInductionResolverView =
    buildWorldSimulationRelationalSchemaInductionResolverView({
      multi_experience_schema_evidence: multiExperienceSchemaEvidence,
    });
  const relationalSchemaInductionResolver =
    typeof options.relationalSchemaInductionResolver === "function"
      ? options.relationalSchemaInductionResolver
      : null;
  const rawRelationalSchemaProposals =
    relationalSchemaInductionResolver
      ? await relationalSchemaInductionResolver(
        cloneJson(relationalSchemaInductionResolverView),
      )
      : [];
  if (!Array.isArray(rawRelationalSchemaProposals)) {
    const error = new Error(
      "relationalSchemaInductionResolver must return an array of bounded relational schema proposals.",
    );
    error.code = "WORLD_SIMULATION_RELATIONAL_SCHEMA_INDUCTION_RESOLVER_INVALID_OUTPUT";
    throw error;
  }
  const relationalSchemaInduction =
    projectWorldSimulationRelationalSchemaInduction({
      multi_experience_schema_evidence: multiExperienceSchemaEvidence,
      resolver_view_hash: relationalSchemaInductionResolverView.resolver_view_hash,
      schema_proposals: rawRelationalSchemaProposals,
    });

  // Phase77C is an admission boundary, not another semantic-memory authority.
  // The promoter sees only bounded Phase77B schema candidates and may return
  // promote/skip decisions. It cannot author schema text, choose a semantic
  // identity, or write World State. The legal Phase67C form/support operation is
  // derived later, after the ordinary Phase67C pass has had first opportunity to
  // establish an exact semantic identity for this turn.
  const relationalSchemaPromotionResolverView =
    buildWorldSimulationRelationalSchemaPromotionResolverView({
      relational_schema_induction: relationalSchemaInduction,
    });
  const relationalSchemaPromotionResolver =
    typeof options.relationalSchemaPromotionResolver === "function"
      ? options.relationalSchemaPromotionResolver
      : null;
  const rawRelationalSchemaPromotionDecisions =
    relationalSchemaPromotionResolver
      ? await relationalSchemaPromotionResolver(
        cloneJson(relationalSchemaPromotionResolverView),
      )
      : [];
  if (!Array.isArray(rawRelationalSchemaPromotionDecisions)) {
    const error = new Error(
      "relationalSchemaPromotionResolver must return an array of explicit Phase77B proposal promotion decisions.",
    );
    error.code = "WORLD_SIMULATION_RELATIONAL_SCHEMA_PROMOTION_RESOLVER_INVALID_OUTPUT";
    throw error;
  }

  const personalSemanticDecisionResolution =
    await resolvePersonalSemanticMemoryDecisions(
      autobiographicalLifeEventOrganizationMutationExecution.next_world_state,
      preparedTurn,
      personalSemanticSourceOrganizationEventIds,
      options,
    );

  const personalSemanticMemoryDerivation =
    buildWorldSimulationPersonalSemanticMemoryDerivations({
      world_state:
        autobiographicalLifeEventOrganizationMutationExecution.next_world_state,
      turn_id:
        preparedTurn.turn_id,
      source_organization_event_ids:
        personalSemanticSourceOrganizationEventIds,
      semantic_decisions:
        personalSemanticDecisionResolution.decisions,
    });

  const personalSemanticMemoryMutationQueue =
    buildWorldSimulationChronologicalMutationQueue({
      turn_id:
        `${preparedTurn.turn_id}:personal_semantic_memory`,
      world_state_hash:
        hashAgentRunValue(
          autobiographicalLifeEventOrganizationMutationExecution.next_world_state,
        ),
      state_transitions:
        personalSemanticMemoryDerivation
          .result
          .state_transitions,
      elapsed_ms: 0,
    });

  const personalSemanticMemoryMutationExecution =
    executeWorldSimulationChronologicalMutationQueue({
      world_state:
        autobiographicalLifeEventOrganizationMutationExecution.next_world_state,
      preview_world_state:
        personalSemanticMemoryDerivation
          .result
          .preview_world_state,
      queue:
        personalSemanticMemoryMutationQueue,
      scene_id:
        preparedTurn.event?.scene_id
        ?? preparedTurn.event?.location_id
        ?? null,
    });

  // Phase77C now resolves its previously explicit admission decisions against
  // the post-ordinary-Phase67C semantic state. Exact descriptor identity may
  // become support; otherwise a new recurring-event pattern may be formed. No
  // fuzzy merge, descriptor rewriting, or direct durable write is permitted.
  const relationalSchemaPromotion =
    projectWorldSimulationRelationalSchemaPromotion({
      world_state: personalSemanticMemoryMutationExecution.next_world_state,
      relational_schema_induction: relationalSchemaInduction,
      resolver_view_hash: relationalSchemaPromotionResolverView.resolver_view_hash,
      promotion_decisions: rawRelationalSchemaPromotionDecisions,
    });

  const relationalSchemaSemanticPromotion =
    buildWorldSimulationPersonalSemanticMemoryDerivations({
      world_state: personalSemanticMemoryMutationExecution.next_world_state,
      turn_id: preparedTurn.turn_id,
      source_organization_event_ids: personalSemanticSourceOrganizationEventIds,
      semantic_decisions: relationalSchemaPromotion.semantic_decisions,
    });
  const relationalSchemaSemanticPromotionMutationQueue =
    buildWorldSimulationChronologicalMutationQueue({
      turn_id: `${preparedTurn.turn_id}:personal_semantic_memory`,
      world_state_hash: hashAgentRunValue(
        personalSemanticMemoryMutationExecution.next_world_state,
      ),
      state_transitions:
        relationalSchemaSemanticPromotion.result.state_transitions,
      elapsed_ms: 0,
    });
  const relationalSchemaSemanticPromotionMutationExecution =
    executeWorldSimulationChronologicalMutationQueue({
      world_state: personalSemanticMemoryMutationExecution.next_world_state,
      preview_world_state:
        relationalSchemaSemanticPromotion.result.preview_world_state,
      queue: relationalSchemaSemanticPromotionMutationQueue,
      scene_id:
        preparedTurn.event?.scene_id
        ?? preparedTurn.event?.location_id
        ?? null,
    });

  // Phase76G evaluates only applications that Phase76F proved were actually
  // selected. Its resolver sees bounded subjective post-outcome experience and
  // method structure, never raw action outcomes or hidden causal evidence. The
  // resulting assessment still cannot write semantic memory directly: support
  // and counterevidence are emitted as ordinary Phase67C decisions below.
  const experientialMethodOutcomeCreditResolverContext =
    buildWorldSimulationExperientialMethodOutcomeCreditResolverContext({
      world_state: relationalSchemaSemanticPromotionMutationExecution.next_world_state,
      turn_id: preparedTurn.turn_id,
      selected_application_receipts:
        selectedExperientialMethodApplicationReceipts,
      phase76b_memory_bridge: postOutcomeSubjectiveMemoryBridge,
      source_memory_records: subjectiveClaimSourceMemories,
      source_organization_event_ids: personalSemanticSourceOrganizationEventIds,
      experiential_knowledge_reentry_projections:
        preparedTurn.experiential_knowledge_reentry_projections ?? [],
      experiential_method_transfer_projections:
        preparedTurn.experiential_method_transfer_projections ?? [],
    });
  const experientialMethodOutcomeCreditResolver =
    typeof options.experientialMethodOutcomeCreditResolver === "function"
      ? options.experientialMethodOutcomeCreditResolver
      : null;
  const rawExperientialMethodOutcomeCreditAssessments =
    experientialMethodOutcomeCreditResolver
      ? await experientialMethodOutcomeCreditResolver(
        cloneJson(experientialMethodOutcomeCreditResolverContext.resolver_view),
      )
      : [];
  if (!Array.isArray(rawExperientialMethodOutcomeCreditAssessments)) {
    const error = new Error(
      "experientialMethodOutcomeCreditResolver must return an array of application_ref/assessment pairs.",
    );
    error.code =
      "WORLD_SIMULATION_EXPERIENTIAL_METHOD_OUTCOME_CREDIT_RESOLVER_INVALID_OUTPUT";
    throw error;
  }
  const experientialMethodOutcomeCredit =
    projectWorldSimulationExperientialMethodOutcomeCredit({
      resolver_context: experientialMethodOutcomeCreditResolverContext,
      assessment_decisions: rawExperientialMethodOutcomeCreditAssessments,
    });

  // Phase79H closes the outcome-side provenance edge for an impasse resolution
  // without turning a single selected-method outcome into a comparative claim.
  // It joins only canonical Phase79G resolution->application lineage with the
  // exact Phase76G subjective assessment for that same Phase76F application.
  // No alternative method was executed here, so superiority, resolution success,
  // and durable preference retention all remain deliberately unclaimed.
  const experientialMethodImpasseResolutionOutcomeEvidence =
    buildWorldSimulationExperientialMethodImpasseResolutionOutcomeEvidence({
      world_simulation_session_id: sessionId,
      turn_id: preparedTurn.turn_id,
      state_revision: snapshot.revision,
      world_state_hash: snapshot.state_hash,
      impasse_resolution_application_lineage:
        experientialMethodImpasseResolutionApplicationLineage,
      experiential_method_outcome_credit:
        experientialMethodOutcomeCredit,
    });

  // Retain/revise remains Phase67C-owned. This is deliberately a later legal
  // append-only Phase67C pass after both the ordinary semantic resolver and the
  // Phase77C schema-admission pass, so method-outcome evidence cannot create a
  // parallel semantic store or override either earlier legal decision. No exact
  // current LifeEvent provenance means a Phase76G assessment may be recorded
  // but this pass remains a no-op.
  const experientialMethodSemanticRevision =
    buildWorldSimulationPersonalSemanticMemoryDerivations({
      world_state: relationalSchemaSemanticPromotionMutationExecution.next_world_state,
      turn_id: preparedTurn.turn_id,
      source_organization_event_ids: personalSemanticSourceOrganizationEventIds,
      semantic_decisions: experientialMethodOutcomeCredit.semantic_decisions,
    });
  const experientialMethodSemanticRevisionMutationQueue =
    buildWorldSimulationChronologicalMutationQueue({
      turn_id: `${preparedTurn.turn_id}:personal_semantic_memory`,
      world_state_hash: hashAgentRunValue(
        relationalSchemaSemanticPromotionMutationExecution.next_world_state,
      ),
      state_transitions:
        experientialMethodSemanticRevision.result.state_transitions,
      elapsed_ms: 0,
    });
  const experientialMethodSemanticRevisionMutationExecution =
    executeWorldSimulationChronologicalMutationQueue({
      world_state: relationalSchemaSemanticPromotionMutationExecution.next_world_state,
      preview_world_state:
        experientialMethodSemanticRevision.result.preview_world_state,
      queue: experientialMethodSemanticRevisionMutationQueue,
      scene_id:
        preparedTurn.event?.scene_id
        ?? preparedTurn.event?.location_id
        ?? null,
    });

  // Phase78A observes the fully legal Phase67C semantic state only after the
  // Phase76G retain/revise pass has been materialized. It assembles bounded
  // support-vs-counterexample evidence for newly contested recurring schemas;
  // it does not author a refinement or feed anything back into this turn's
  // Character Brain.
  const contextualSchemaRefinementEvidence =
    buildWorldSimulationContextualSchemaRefinementEvidenceView({
      world_state: experientialMethodSemanticRevisionMutationExecution.next_world_state,
      turn_id: preparedTurn.turn_id,
      source_organization_event_ids: personalSemanticSourceOrganizationEventIds,
    });

  // Phase78B consumes only the exact bounded Phase78A projection. The resolver
  // may propose additive narrowing qualifiers grounded in both support and
  // counterexample evidence, but it cannot rewrite the contested source schema,
  // emit a Phase67C semantic decision, or affect the same-turn Character Brain.
  const contextualSchemaSpecializationResolverView =
    buildWorldSimulationContextualSchemaSpecializationResolverView({
      contextual_schema_refinement_evidence: contextualSchemaRefinementEvidence,
    });
  const contextualSchemaSpecializationResolver =
    typeof options.contextualSchemaSpecializationResolver === "function"
      ? options.contextualSchemaSpecializationResolver
      : null;
  const rawContextualSchemaSpecializationProposals =
    contextualSchemaSpecializationResolver
      ? await contextualSchemaSpecializationResolver(
        cloneJson(contextualSchemaSpecializationResolverView),
      )
      : [];
  if (!Array.isArray(rawContextualSchemaSpecializationProposals)) {
    const error = new Error(
      "contextualSchemaSpecializationResolver must return an array of bounded specialization proposals.",
    );
    error.code = "WORLD_SIMULATION_CONTEXTUAL_SCHEMA_SPECIALIZATION_RESOLVER_INVALID_OUTPUT";
    throw error;
  }
  const contextualSchemaSpecialization =
    projectWorldSimulationContextualSchemaSpecialization({
      contextual_schema_refinement_evidence: contextualSchemaRefinementEvidence,
      resolver_view_hash: contextualSchemaSpecializationResolverView.resolver_view_hash,
      specialization_proposals: rawContextualSchemaSpecializationProposals,
    });

  // Phase78C is the explicit retain/admission boundary for Phase78B proposals.
  // The resolver may only admit or skip an exact specialization proposal. The
  // service verifies the still-contested Phase67C source and the exact Phase78A
  // evidence lineage, then emits only ordinary Phase67C form/support decisions.
  // The contested source semantic is never rewritten or resolved here.
  const contextualSchemaSpecializationAdmissionResolverView =
    buildWorldSimulationContextualSchemaSpecializationAdmissionResolverView({
      contextual_schema_refinement_evidence: contextualSchemaRefinementEvidence,
      contextual_schema_specialization: contextualSchemaSpecialization,
    });
  const contextualSchemaSpecializationAdmissionResolver =
    typeof options.contextualSchemaSpecializationAdmissionResolver === "function"
      ? options.contextualSchemaSpecializationAdmissionResolver
      : null;
  const rawContextualSchemaSpecializationAdmissionDecisions =
    contextualSchemaSpecializationAdmissionResolver
      ? await contextualSchemaSpecializationAdmissionResolver(
        cloneJson(contextualSchemaSpecializationAdmissionResolverView),
      )
      : [];
  if (!Array.isArray(rawContextualSchemaSpecializationAdmissionDecisions)) {
    const error = new Error(
      "contextualSchemaSpecializationAdmissionResolver must return an array of admit/skip decisions.",
    );
    error.code =
      "WORLD_SIMULATION_CONTEXTUAL_SCHEMA_SPECIALIZATION_ADMISSION_RESOLVER_INVALID_OUTPUT";
    throw error;
  }
  const contextualSchemaSpecializationAdmission =
    projectWorldSimulationContextualSchemaSpecializationAdmission({
      world_state: experientialMethodSemanticRevisionMutationExecution.next_world_state,
      contextual_schema_refinement_evidence: contextualSchemaRefinementEvidence,
      contextual_schema_specialization: contextualSchemaSpecialization,
      resolver_view_hash:
        contextualSchemaSpecializationAdmissionResolverView.resolver_view_hash,
      admission_decisions: rawContextualSchemaSpecializationAdmissionDecisions,
    });
  const contextualSchemaSpecializationSemanticRetention =
    buildWorldSimulationPersonalSemanticMemoryDerivations({
      world_state: experientialMethodSemanticRevisionMutationExecution.next_world_state,
      turn_id: preparedTurn.turn_id,
      source_organization_event_ids: personalSemanticSourceOrganizationEventIds,
      semantic_decisions: contextualSchemaSpecializationAdmission.semantic_decisions,
    });
  const contextualSchemaSpecializationSemanticRetentionMutationQueue =
    buildWorldSimulationChronologicalMutationQueue({
      turn_id: `${preparedTurn.turn_id}:personal_semantic_memory`,
      world_state_hash: hashAgentRunValue(
        experientialMethodSemanticRevisionMutationExecution.next_world_state,
      ),
      state_transitions:
        contextualSchemaSpecializationSemanticRetention.result.state_transitions,
      elapsed_ms: 0,
    });
  const contextualSchemaSpecializationSemanticRetentionMutationExecution =
    executeWorldSimulationChronologicalMutationQueue({
      world_state: experientialMethodSemanticRevisionMutationExecution.next_world_state,
      preview_world_state:
        contextualSchemaSpecializationSemanticRetention.result.preview_world_state,
      queue: contextualSchemaSpecializationSemanticRetentionMutationQueue,
      scene_id:
        preparedTurn.event?.scene_id
        ?? preparedTurn.event?.location_id
        ?? null,
    });

  const autobiographicalLifePeriodSourceSemanticDerivationEventIds = [
    ...personalSemanticMemoryDerivation
      .result
      .derivation_events_created
      .map((event) => event.derivation_event_id),
    ...relationalSchemaSemanticPromotion
      .result
      .derivation_events_created
      .map((event) => event.derivation_event_id),
    ...experientialMethodSemanticRevision
      .result
      .derivation_events_created
      .map((event) => event.derivation_event_id),
    ...contextualSchemaSpecializationSemanticRetention
      .result
      .derivation_events_created
      .map((event) => event.derivation_event_id),
  ];

  const autobiographicalLifePeriodDecisionResolution =
    await resolveAutobiographicalLifePeriodOrganizationDecisions(
      contextualSchemaSpecializationSemanticRetentionMutationExecution.next_world_state,
      preparedTurn,
      personalSemanticSourceOrganizationEventIds,
      autobiographicalLifePeriodSourceSemanticDerivationEventIds,
      options,
    );

  const autobiographicalLifePeriodOrganization =
    buildWorldSimulationAutobiographicalLifePeriodOrganizations({
      world_state:
        contextualSchemaSpecializationSemanticRetentionMutationExecution.next_world_state,
      turn_id:
        preparedTurn.turn_id,
      source_organization_event_ids:
        personalSemanticSourceOrganizationEventIds,
      source_semantic_derivation_event_ids:
        autobiographicalLifePeriodSourceSemanticDerivationEventIds,
      organization_decisions:
        autobiographicalLifePeriodDecisionResolution.decisions,
    });

  const autobiographicalLifePeriodMutationQueue =
    buildWorldSimulationChronologicalMutationQueue({
      turn_id:
        `${preparedTurn.turn_id}:autobiographical_life_period`,
      world_state_hash:
        hashAgentRunValue(
          contextualSchemaSpecializationSemanticRetentionMutationExecution.next_world_state,
        ),
      state_transitions:
        autobiographicalLifePeriodOrganization
          .result
          .state_transitions,
      elapsed_ms: 0,
    });

  const autobiographicalLifePeriodMutationExecution =
    executeWorldSimulationChronologicalMutationQueue({
      world_state:
        contextualSchemaSpecializationSemanticRetentionMutationExecution.next_world_state,
      preview_world_state:
        autobiographicalLifePeriodOrganization
          .result
          .preview_world_state,
      queue:
        autobiographicalLifePeriodMutationQueue,
      scene_id:
        preparedTurn.event?.scene_id
        ?? preparedTurn.event?.location_id
        ?? null,
    });

  const autobiographicalSelfInterpretationDecisionResolution =
    await resolveAutobiographicalSelfInterpretationDecisions(
      autobiographicalLifePeriodMutationExecution.next_world_state,
      preparedTurn,
      options,
    );

  const autobiographicalSelfInterpretation =
    buildWorldSimulationAutobiographicalSelfInterpretations({
      world_state:
        autobiographicalLifePeriodMutationExecution.next_world_state,
      turn_id:
        preparedTurn.turn_id,
      interpretation_decisions:
        autobiographicalSelfInterpretationDecisionResolution.decisions,
    });

  const autobiographicalSelfInterpretationMutationQueue =
    buildWorldSimulationChronologicalMutationQueue({
      turn_id:
        `${preparedTurn.turn_id}:autobiographical_self_interpretation`,
      world_state_hash:
        hashAgentRunValue(
          autobiographicalLifePeriodMutationExecution.next_world_state,
        ),
      state_transitions:
        autobiographicalSelfInterpretation.result.state_transitions,
      elapsed_ms: 0,
    });

  const autobiographicalSelfInterpretationMutationExecution =
    executeWorldSimulationChronologicalMutationQueue({
      world_state:
        autobiographicalLifePeriodMutationExecution.next_world_state,
      preview_world_state:
        autobiographicalSelfInterpretation.result.preview_world_state,
      queue:
        autobiographicalSelfInterpretationMutationQueue,
      scene_id:
        preparedTurn.event?.scene_id
        ?? preparedTurn.event?.location_id
        ?? null,
    });

  const structuredSelfModelDecisionResolution =
    await resolveStructuredSelfModelDecisions(
      autobiographicalSelfInterpretationMutationExecution.next_world_state,
      preparedTurn,
      options,
    );

  const structuredSelfModel =
    buildWorldSimulationStructuredSelfModelAspects({
      world_state:
        autobiographicalSelfInterpretationMutationExecution.next_world_state,
      turn_id:
        preparedTurn.turn_id,
      aspect_decisions:
        structuredSelfModelDecisionResolution.decisions,
    });

  const structuredSelfModelMutationQueue =
    buildWorldSimulationChronologicalMutationQueue({
      turn_id:
        `${preparedTurn.turn_id}:structured_self_model`,
      world_state_hash:
        hashAgentRunValue(
          autobiographicalSelfInterpretationMutationExecution.next_world_state,
        ),
      state_transitions:
        structuredSelfModel.result.state_transitions,
      elapsed_ms: 0,
    });

  const structuredSelfModelMutationExecution =
    executeWorldSimulationChronologicalMutationQueue({
      world_state:
        autobiographicalSelfInterpretationMutationExecution.next_world_state,
      preview_world_state:
        structuredSelfModel.result.preview_world_state,
      queue:
        structuredSelfModelMutationQueue,
      scene_id:
        preparedTurn.event?.scene_id
        ?? preparedTurn.event?.location_id
        ?? null,
    });

  const structuredSelfModelRevisionDecisionResolution =
    await resolveStructuredSelfModelRevisionDecisions(
      structuredSelfModelMutationExecution.next_world_state,
      preparedTurn,
      options,
    );

  const structuredSelfModelRevision =
    buildWorldSimulationStructuredSelfModelRevisions({
      world_state:
        structuredSelfModelMutationExecution.next_world_state,
      turn_id:
        preparedTurn.turn_id,
      revision_decisions:
        structuredSelfModelRevisionDecisionResolution.decisions,
    });

  const structuredSelfModelRevisionMutationQueue =
    buildWorldSimulationChronologicalMutationQueue({
      turn_id:
        `${preparedTurn.turn_id}:structured_self_model_revision`,
      world_state_hash:
        hashAgentRunValue(
          structuredSelfModelMutationExecution.next_world_state,
        ),
      state_transitions:
        structuredSelfModelRevision.result.state_transitions,
      elapsed_ms: 0,
    });

  const structuredSelfModelRevisionMutationExecution =
    executeWorldSimulationChronologicalMutationQueue({
      world_state:
        structuredSelfModelMutationExecution.next_world_state,
      preview_world_state:
        structuredSelfModelRevision.result.preview_world_state,
      queue:
        structuredSelfModelRevisionMutationQueue,
      scene_id:
        preparedTurn.event?.scene_id
        ?? preparedTurn.event?.location_id
        ?? null,
    });

  // Phase76C interprets only current-turn Phase76B action-experience memories.
  // The interpreter selects a bounded, situation-specific assessment; the
  // service owns the scoped proposition text and emits only ordinary Phase65
  // claim proposals. It never receives raw outcomes or hidden causal truth.
  const experienceGroundedSubjectiveLearningInterpretationResolution =
    await resolveExperienceGroundedSubjectiveLearningInterpretations(
      structuredSelfModelRevisionMutationExecution.next_world_state,
      preparedTurn,
      subjectiveClaimSourceMemories,
      postOutcomeSubjectiveMemoryBridge,
      options,
    );

  // Phase73B interprets only current-turn subjective memories that carry the
  // Phase73A constraint-observation guards. It may compare those memories with
  // the same character's currently represented means and already-committed
  // subjective cognition, but it never receives Phase72's objective verdict or
  // source-plan binding. Its only output is an ordinary Phase65 claim proposal.
  const subjectiveMeansFeasibilityInterpretationResolution =
    await resolveSubjectiveMeansFeasibilityInterpretations(
      structuredSelfModelRevisionMutationExecution.next_world_state,
      preparedTurn,
      subjectiveClaimSourceMemories,
      options,
    );

  const subjectiveClaimProposalResolution =
    await resolveSubjectiveClaimProposals(
      structuredSelfModelRevisionMutationExecution.next_world_state,
      preparedTurn,
      subjectiveClaimSourceMemories,
      options,
    );

  const subjectiveClaimProposals = [
    ...experienceGroundedSubjectiveLearningInterpretationResolution.claim_proposals,
    ...subjectiveMeansFeasibilityInterpretationResolution.claim_proposals,
    ...subjectiveClaimProposalResolution.proposals,
  ];

  const subjectiveClaimProjection =
    buildWorldSimulationSubjectiveClaims({
      world_state:
        structuredSelfModelRevisionMutationExecution.next_world_state,
      turn_id:
        preparedTurn.turn_id,
      source_memory_records:
        subjectiveClaimSourceMemories,
      claim_proposals:
        subjectiveClaimProposals,
    });

  const subjectiveClaimMutationQueue =
    buildWorldSimulationChronologicalMutationQueue({
      turn_id:
        `${preparedTurn.turn_id}:subjective_claim`,
      world_state_hash:
        hashAgentRunValue(
          structuredSelfModelRevisionMutationExecution.next_world_state,
        ),
      state_transitions:
        subjectiveClaimProjection
          .result
          .state_transitions,
      elapsed_ms: 0,
    });

  const subjectiveClaimMutationExecution =
    executeWorldSimulationChronologicalMutationQueue({
      world_state:
        structuredSelfModelRevisionMutationExecution.next_world_state,
      preview_world_state:
        subjectiveClaimProjection
          .result
          .preview_world_state,
      queue:
        subjectiveClaimMutationQueue,
      scene_id:
        preparedTurn.event?.scene_id
        ?? preparedTurn.event?.location_id
        ?? null,
    });

  const subjectiveClaimRelationProposalResolution =
    await resolveSubjectiveClaimRelationProposals(
      subjectiveClaimMutationExecution.next_world_state,
      preparedTurn,
      options,
    );

  const subjectiveClaimConflictRevisionProjection =
    buildWorldSimulationSubjectiveClaimConflictRevisions({
      world_state:
        subjectiveClaimMutationExecution.next_world_state,
      turn_id:
        preparedTurn.turn_id,
      relation_proposals:
        subjectiveClaimRelationProposalResolution.proposals,
    });

  const subjectiveClaimRelationMutationQueue =
    buildWorldSimulationChronologicalMutationQueue({
      turn_id:
        `${preparedTurn.turn_id}:subjective_claim_relation`,
      world_state_hash:
        hashAgentRunValue(
          subjectiveClaimMutationExecution.next_world_state,
        ),
      state_transitions:
        subjectiveClaimConflictRevisionProjection
          .result
          .state_transitions,
      elapsed_ms: 0,
    });

  const subjectiveClaimRelationMutationExecution =
    executeWorldSimulationChronologicalMutationQueue({
      world_state:
        subjectiveClaimMutationExecution.next_world_state,
      preview_world_state:
        subjectiveClaimConflictRevisionProjection
          .result
          .preview_world_state,
      queue:
        subjectiveClaimRelationMutationQueue,
      scene_id:
        preparedTurn.event?.scene_id
        ?? preparedTurn.event?.location_id
        ?? null,
    });

  const subjectiveBeliefResolution =
    resolveWorldSimulationSubjectiveBeliefs({
      world_state:
        subjectiveClaimRelationMutationExecution.next_world_state,
      turn_id:
        preparedTurn.turn_id,
    });

  const subjectiveBeliefRevision =
    buildWorldSimulationSubjectiveBeliefRevisions({
      world_state:
        subjectiveClaimRelationMutationExecution.next_world_state,
      turn_id:
        preparedTurn.turn_id,
      resolution:
        subjectiveBeliefResolution.result,
    });

  const subjectiveBeliefRevisionMutationQueue =
    buildWorldSimulationChronologicalMutationQueue({
      turn_id:
        `${preparedTurn.turn_id}:subjective_belief_revision`,
      world_state_hash:
        hashAgentRunValue(
          subjectiveClaimRelationMutationExecution.next_world_state,
        ),
      state_transitions:
        subjectiveBeliefRevision
          .result
          .state_transitions,
      elapsed_ms: 0,
    });

  const subjectiveBeliefRevisionMutationExecution =
    executeWorldSimulationChronologicalMutationQueue({
      world_state:
        subjectiveClaimRelationMutationExecution.next_world_state,
      preview_world_state:
        subjectiveBeliefRevision
          .result
          .preview_world_state,
      queue:
        subjectiveBeliefRevisionMutationQueue,
      scene_id:
        preparedTurn.event?.scene_id
        ?? preparedTurn.event?.location_id
        ?? null,
    });

  // Phase73C persists only the semantic lineage between the normalized
  // Phase73B interpretation and its canonical Phase65 claim. Phase66 remains
  // the sole authority over whether that claim is an active belief. This turn's
  // linkage cannot affect Phase71 below because Phase71 reads snapshot.state.
  const subjectiveMeansFeasibilityLinkage =
    buildWorldSimulationSubjectiveMeansFeasibilityLinkages({
      world_state:
        subjectiveBeliefRevisionMutationExecution.next_world_state,
      turn_id:
        preparedTurn.turn_id,
      interpretation_decisions:
        subjectiveMeansFeasibilityInterpretationResolution.decisions,
    });

  const subjectiveMeansFeasibilityLinkageMutationQueue =
    buildWorldSimulationChronologicalMutationQueue({
      turn_id:
        `${preparedTurn.turn_id}:subjective_means_feasibility_linkage`,
      world_state_hash:
        hashAgentRunValue(
          subjectiveBeliefRevisionMutationExecution.next_world_state,
        ),
      state_transitions:
        subjectiveMeansFeasibilityLinkage.result.state_transitions,
      validation_context: {
        subjective_means_feasibility_reconsideration:
          subjectiveMeansFeasibilityLinkage.result.authoritative_validation_context,
      },
      elapsed_ms: 0,
    });

  const subjectiveMeansFeasibilityLinkageMutationExecution =
    executeWorldSimulationChronologicalMutationQueue({
      world_state:
        subjectiveBeliefRevisionMutationExecution.next_world_state,
      preview_world_state:
        subjectiveMeansFeasibilityLinkage.result.preview_world_state,
      queue:
        subjectiveMeansFeasibilityLinkageMutationQueue,
      scene_id:
        preparedTurn.event?.scene_id
        ?? preparedTurn.event?.location_id
        ?? null,
    });

  // Phase69D consumes only the plan state committed before this turn, paired
  // with this turn's authoritative causal outcome. Same-turn cognitive writes
  // cannot become retroactive execution targets, and outcome labels never
  // imply completion without an explicit resolver decision.
  const implementationIntentionExecutionFeedbackDecisionResolution =
    await resolveImplementationIntentionExecutionFeedbackDecisions(
      snapshot.state,
      preparedTurn,
      selected,
      array(causalResolution.action_outcomes),
      options,
    );

  const implementationIntentionExecutionFeedback =
    buildWorldSimulationGoalImplementationIntentionExecutionFeedback({
      world_state:
        subjectiveMeansFeasibilityLinkageMutationExecution.next_world_state,
      turn_id:
        preparedTurn.turn_id,
      feedback_decisions:
        implementationIntentionExecutionFeedbackDecisionResolution.decisions,
      resolver_view:
        implementationIntentionExecutionFeedbackDecisionResolution.resolver_view,
    });

  const implementationIntentionExecutionFeedbackMutationQueue =
    buildWorldSimulationChronologicalMutationQueue({
      turn_id:
        `${preparedTurn.turn_id}:goal_implementation_intention_execution_feedback`,
      world_state_hash:
        hashAgentRunValue(
          subjectiveMeansFeasibilityLinkageMutationExecution.next_world_state,
        ),
      state_transitions:
        implementationIntentionExecutionFeedback.result.state_transitions,
      elapsed_ms: 0,
    });

  const implementationIntentionExecutionFeedbackMutationExecution =
    executeWorldSimulationChronologicalMutationQueue({
      world_state:
        subjectiveMeansFeasibilityLinkageMutationExecution.next_world_state,
      preview_world_state:
        implementationIntentionExecutionFeedback.result.preview_world_state,
      queue:
        implementationIntentionExecutionFeedbackMutationQueue,
      scene_id:
        preparedTurn.event?.scene_id
        ?? preparedTurn.event?.location_id
        ?? null,
    });

  // Phase70A verifies goal-condition attainment only from the goal state that
  // existed before this turn plus bounded authoritative causal evidence from
  // this turn. Plan completion and action success never auto-promote a goal.
  const goalAchievementDecisionResolution =
    await resolveGoalAchievementDecisions(
      snapshot.state,
      preparedTurn,
      causalResolution,
      options,
    );

  const goalAchievement = buildWorldSimulationGoalAchievementEvents({
    world_state:
      implementationIntentionExecutionFeedbackMutationExecution.next_world_state,
    turn_id:
      preparedTurn.turn_id,
    achievement_decisions:
      goalAchievementDecisionResolution.decisions,
    resolver_view:
      goalAchievementDecisionResolution.resolver_view,
  });

  const goalAchievementMutationQueue =
    buildWorldSimulationChronologicalMutationQueue({
      turn_id:
        `${preparedTurn.turn_id}:goal_achievement_verification`,
      world_state_hash:
        hashAgentRunValue(
          implementationIntentionExecutionFeedbackMutationExecution.next_world_state,
        ),
      state_transitions:
        goalAchievement.result.state_transitions,
      validation_context: {
        goal_achievement_verification:
          goalAchievement.result.authoritative_validation_context,
      },
      elapsed_ms: 0,
    });

  const goalAchievementMutationExecution =
    executeWorldSimulationChronologicalMutationQueue({
      world_state:
        implementationIntentionExecutionFeedbackMutationExecution.next_world_state,
      preview_world_state:
        goalAchievement.result.preview_world_state,
      queue:
        goalAchievementMutationQueue,
      scene_id:
        preparedTurn.event?.scene_id
        ?? preparedTurn.event?.location_id
        ?? null,
    });

  // Phase70B evaluates whether an otherwise-existing goal has explicit,
  // evidence-backed proof of unattainability. It runs after Phase70A so a
  // same-turn verified achievement cannot also become unattainable. Failure of
  // an action/plan or lack of progress alone never creates this verdict.
  const goalViabilityDecisionResolution =
    await resolveGoalViabilityDecisions(
      snapshot.state,
      preparedTurn,
      causalResolution,
      options,
    );

  const goalUnattainability = buildWorldSimulationGoalUnattainabilityEvents({
    world_state:
      goalAchievementMutationExecution.next_world_state,
    turn_id:
      preparedTurn.turn_id,
    unattainability_decisions:
      goalViabilityDecisionResolution.decisions,
    resolver_view:
      goalViabilityDecisionResolution.resolver_view,
  });

  const goalUnattainabilityMutationQueue =
    buildWorldSimulationChronologicalMutationQueue({
      turn_id:
        `${preparedTurn.turn_id}:goal_viability_unattainability`,
      world_state_hash:
        hashAgentRunValue(
          goalAchievementMutationExecution.next_world_state,
        ),
      state_transitions:
        goalUnattainability.result.state_transitions,
      validation_context: {
        goal_viability_unattainability:
          goalUnattainability.result.authoritative_validation_context,
      },
      elapsed_ms: 0,
    });

  const goalUnattainabilityMutationExecution =
    executeWorldSimulationChronologicalMutationQueue({
      world_state:
        goalAchievementMutationExecution.next_world_state,
      preview_world_state:
        goalUnattainability.result.preview_world_state,
      queue:
        goalUnattainabilityMutationQueue,
      scene_id:
        preparedTurn.event?.scene_id
        ?? preparedTurn.event?.location_id
        ?? null,
    });

  // Phase70C is a separate motivational reconsideration layer. Its resolver
  // sees only the goal-adjustment state committed before this turn, so a new
  // same-turn Phase70B unattainability certificate never auto-disengages the
  // goal. Reengagement redirects only toward another already-committed goal;
  // it does not revive the impossible source goal or perform replanning.
  const goalAdjustmentDecisionResolution =
    await resolveGoalAdjustmentDecisions(
      snapshot.state,
      preparedTurn,
      options,
    );

  const goalAdjustment = buildWorldSimulationGoalAdjustmentEvents({
    world_state:
      goalUnattainabilityMutationExecution.next_world_state,
    turn_id:
      preparedTurn.turn_id,
    adjustment_decisions:
      goalAdjustmentDecisionResolution.decisions,
    resolver_view:
      goalAdjustmentDecisionResolution.resolver_view,
  });

  const goalAdjustmentMutationQueue =
    buildWorldSimulationChronologicalMutationQueue({
      turn_id:
        `${preparedTurn.turn_id}:goal_disengagement_reengagement`,
      world_state_hash:
        hashAgentRunValue(
          goalUnattainabilityMutationExecution.next_world_state,
        ),
      state_transitions:
        goalAdjustment.result.state_transitions,
      validation_context: {
        goal_disengagement_reengagement:
          goalAdjustment.result.authoritative_validation_context,
      },
      elapsed_ms: 0,
    });

  const goalAdjustmentMutationExecution =
    executeWorldSimulationChronologicalMutationQueue({
      world_state:
        goalUnattainabilityMutationExecution.next_world_state,
      preview_world_state:
        goalAdjustment.result.preview_world_state,
      queue:
        goalAdjustmentMutationQueue,
      scene_id:
        preparedTurn.event?.scene_id
        ?? preparedTurn.event?.location_id
        ?? null,
    });

  // Phase71 keeps the same viable committed goal while replacing only a means
  // that has a durable prior-turn failure streak. Candidate generation and
  // choice are both bounded surfaces. The resolver never sees raw World State,
  // and same-turn Phase69D failure cannot create the eligibility catalog.
  const adaptiveReplanningDecisionResolution =
    await resolveAdaptiveReplanningDecisions(
      snapshot.state,
      preparedTurn,
      options,
    );

  const adaptiveReplanning = buildWorldSimulationAdaptiveReplanningEvents({
    world_state:
      goalAdjustmentMutationExecution.next_world_state,
    turn_id:
      preparedTurn.turn_id,
    replanning_decisions:
      adaptiveReplanningDecisionResolution.decisions,
    resolver_view:
      adaptiveReplanningDecisionResolution.resolver_view,
  });

  // The actual replacement remains a normal Phase69B revise event. Execute it
  // under the sealed Phase69B queue contract first, then persist Phase71's
  // execution-backed provenance in its own authoritative queue.
  const adaptiveReplanningPhase69BMutationQueue =
    buildWorldSimulationChronologicalMutationQueue({
      turn_id:
        `${preparedTurn.turn_id}:goal_implementation_intention_revision`,
      world_state_hash:
        hashAgentRunValue(goalAdjustmentMutationExecution.next_world_state),
      state_transitions:
        adaptiveReplanning.result.phase69b_revision_state_transitions,
      elapsed_ms: 0,
    });

  const adaptiveReplanningPhase69BMutationExecution =
    executeWorldSimulationChronologicalMutationQueue({
      world_state:
        goalAdjustmentMutationExecution.next_world_state,
      preview_world_state:
        adaptiveReplanning.result.phase69b_preview_world_state,
      queue:
        adaptiveReplanningPhase69BMutationQueue,
      scene_id:
        preparedTurn.event?.scene_id
        ?? preparedTurn.event?.location_id
        ?? null,
    });

  const adaptiveReplanningMutationQueue =
    buildWorldSimulationChronologicalMutationQueue({
      turn_id:
        `${preparedTurn.turn_id}:adaptive_replanning_alternative_means`,
      world_state_hash:
        hashAgentRunValue(
          adaptiveReplanningPhase69BMutationExecution.next_world_state,
        ),
      state_transitions:
        adaptiveReplanning.result.state_transitions,
      validation_context: {
        adaptive_replanning_alternative_means:
          adaptiveReplanning.result.authoritative_validation_context,
      },
      elapsed_ms: 0,
    });

  const adaptiveReplanningMutationExecution =
    executeWorldSimulationChronologicalMutationQueue({
      world_state:
        adaptiveReplanningPhase69BMutationExecution.next_world_state,
      preview_world_state:
        adaptiveReplanning.result.preview_world_state,
      queue:
        adaptiveReplanningMutationQueue,
      scene_id:
        preparedTurn.event?.scene_id
        ?? preparedTurn.event?.location_id
        ?? null,
    });

  // Phase72 validates the executability of the effective post-Phase71 means
  // against a bounded catalog of current-turn engine evidence. It separates
  // physical affordance from authorization and does not mutate the goal/plan,
  // invent another means, or feed hidden world truth directly into character cognition.
  const meansFeasibilityDecisionResolution =
    await resolveMeansFeasibilityDecisions(
      adaptiveReplanningMutationExecution.next_world_state,
      preparedTurn,
      selected,
      causalResolution,
      options,
    );

  const meansFeasibility = buildWorldSimulationMeansFeasibilityEvents({
    world_state:
      adaptiveReplanningMutationExecution.next_world_state,
    turn_id:
      preparedTurn.turn_id,
    feasibility_decisions:
      meansFeasibilityDecisionResolution.decisions,
    resolver_view:
      meansFeasibilityDecisionResolution.resolver_view,
  });

  const meansFeasibilityMutationQueue =
    buildWorldSimulationChronologicalMutationQueue({
      turn_id:
        `${preparedTurn.turn_id}:means_feasibility_capability_affordance`,
      world_state_hash:
        hashAgentRunValue(
          adaptiveReplanningMutationExecution.next_world_state,
        ),
      state_transitions:
        meansFeasibility.result.state_transitions,
      validation_context: {
        means_feasibility_capability_affordance:
          meansFeasibility.result.authoritative_validation_context,
      },
      elapsed_ms: 0,
    });

  const meansFeasibilityMutationExecution =
    executeWorldSimulationChronologicalMutationQueue({
      world_state:
        adaptiveReplanningMutationExecution.next_world_state,
      preview_world_state:
        meansFeasibility.result.preview_world_state,
      queue:
        meansFeasibilityMutationQueue,
      scene_id:
        preparedTurn.event?.scene_id
        ?? preparedTurn.event?.location_id
        ?? null,
    });

  // Phase73A publishes only the Phase72 evidence refs that Phase72 explicitly
  // marked character-visible. The receipt is committed now but cannot enter
  // perception until the next committed state revision, preventing same-turn
  // feasibility verdicts from retroactively altering cognition or replanning.
  const visibleConstraintObservation =
    buildWorldSimulationVisibleConstraintObservations({
      world_state:
        meansFeasibilityMutationExecution.next_world_state,
      turn_id:
        preparedTurn.turn_id,
      source_state_revision:
        snapshot.revision,
      means_feasibility_events:
        meansFeasibility.result.means_feasibility_events_created,
      phase72_authoritative_validation_context:
        meansFeasibility.result.authoritative_validation_context,
    });

  const visibleConstraintObservationMutationQueue =
    buildWorldSimulationChronologicalMutationQueue({
      turn_id:
        `${preparedTurn.turn_id}:visible_constraint_observation`,
      world_state_hash:
        hashAgentRunValue(meansFeasibilityMutationExecution.next_world_state),
      state_transitions:
        visibleConstraintObservation.result.state_transitions,
      validation_context: {
        visible_constraint_observation:
          visibleConstraintObservation.result.authoritative_validation_context,
      },
      elapsed_ms: 0,
    });

  const visibleConstraintObservationMutationExecution =
    executeWorldSimulationChronologicalMutationQueue({
      world_state:
        meansFeasibilityMutationExecution.next_world_state,
      preview_world_state:
        visibleConstraintObservation.result.preview_world_state,
      queue:
        visibleConstraintObservationMutationQueue,
      scene_id:
        preparedTurn.event?.scene_id
        ?? preparedTurn.event?.location_id
        ?? null,
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

  // Phase76A/76B evidence and all subjective memories remain speculative until
  // this atomic commit succeeds. No Character Experience Receipt exists yet.
  const committedCharacterExperienceProjection =
    projectWorldSimulationCharacterExperienceEvidence({
      prepared_turn: preparedTurn,
      selected_action_intents: selected,
      action_outcomes: array(causalResolution.action_outcomes),
      post_outcome_subjective_perception_projection:
        postOutcomeSubjectivePerceptionProjection,
      runtime_identities: committedCharacterRuntimeIdentities,
    });

  const committed = await commitWorldSimulationTurn(
    sessionId,
    {
      expected_revision: snapshot.revision,
      expected_state_hash: snapshot.state_hash,
      turn_id: preparedTurn.turn_id,
      next_world_state: visibleConstraintObservationMutationExecution.next_world_state,
      event: preparedTurn.event,
      selected_action_intents: selected,
      subjective_choice_commitment_receipts:
        cloneJson(subjectiveChoiceCommitmentReceipts),
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

      subjective_memory_plasticity:
        cloneJson(
          subjectiveMemoryPlasticity,
        ),
      subjective_memory_plasticity_mutation_queue:
        cloneJson(
          subjectiveMemoryPlasticityMutationQueue,
        ),
      subjective_memory_plasticity_mutation_execution:
        cloneJson(
          subjectiveMemoryPlasticityMutationExecution.execution,
        ),

      subjective_memory_formation:
        cloneJson(
          subjectiveMemoryFormation,
        ),
      subjective_memory_mutation_queue: cloneJson(subjectiveMemoryMutationQueue),
      subjective_memory_mutation_execution: cloneJson(subjectiveMemoryMutationExecution.execution),

      subjective_episode_segmentation:
        cloneJson(subjectiveEpisodeSegmentation),
      subjective_episode_segmentation_mutation_queue:
        cloneJson(subjectiveEpisodeSegmentationMutationQueue),
      subjective_episode_segmentation_mutation_execution:
        cloneJson(subjectiveEpisodeSegmentationMutationExecution.execution),

      autobiographical_life_event_organization_decision_resolution: {
        version:
          worldSimulationAutobiographicalLifeEventVersion,
        decisions:
          cloneJson(
            autobiographicalLifeEventOrganizationDecisionResolution.decisions,
          ),
        resolver_view_hash:
          autobiographicalLifeEventOrganizationDecisionResolution
            .resolver_view
            .resolver_view_hash,
        audit:
          cloneJson(
            autobiographicalLifeEventOrganizationDecisionResolution.audit,
          ),
      },
      autobiographical_life_event_organization:
        cloneJson(autobiographicalLifeEventOrganization),
      autobiographical_life_event_organization_mutation_queue:
        cloneJson(autobiographicalLifeEventOrganizationMutationQueue),
      autobiographical_life_event_organization_mutation_execution:
        cloneJson(
          autobiographicalLifeEventOrganizationMutationExecution.execution,
        ),
      multi_experience_schema_evidence:
        cloneJson(multiExperienceSchemaEvidence),
      relational_schema_induction: {
        version: worldSimulationRelationalSchemaInductionVersion,
        resolver_used: Boolean(relationalSchemaInductionResolver),
        resolver_view_hash:
          relationalSchemaInductionResolverView.resolver_view_hash,
        projection: cloneJson(relationalSchemaInduction),
      },
      relational_schema_promotion_resolution: {
        version: worldSimulationRelationalSchemaPromotionVersion,
        resolver_used: Boolean(relationalSchemaPromotionResolver),
        resolver_view_hash:
          relationalSchemaPromotionResolverView.resolver_view_hash,
        projection: cloneJson(relationalSchemaPromotion),
      },
      relational_schema_semantic_promotion:
        cloneJson(relationalSchemaSemanticPromotion),
      relational_schema_semantic_promotion_mutation_queue:
        cloneJson(relationalSchemaSemanticPromotionMutationQueue),
      relational_schema_semantic_promotion_mutation_execution:
        cloneJson(relationalSchemaSemanticPromotionMutationExecution.execution),

      personal_semantic_memory_decision_resolution: {
        version:
          worldSimulationPersonalSemanticMemoryVersion,
        decisions:
          cloneJson(personalSemanticDecisionResolution.decisions),
        resolver_view_hash:
          personalSemanticDecisionResolution
            .resolver_view
            .resolver_view_hash,
        audit:
          cloneJson(personalSemanticDecisionResolution.audit),
      },
      personal_semantic_memory_derivation:
        cloneJson(personalSemanticMemoryDerivation),
      personal_semantic_memory_mutation_queue:
        cloneJson(personalSemanticMemoryMutationQueue),
      personal_semantic_memory_mutation_execution:
        cloneJson(personalSemanticMemoryMutationExecution.execution),

      experiential_method_outcome_credit_resolution: {
        version: worldSimulationExperientialMethodOutcomeCreditVersion,
        resolver_view_hash:
          experientialMethodOutcomeCreditResolverContext.resolver_view.resolver_view_hash,
        resolver_used: Boolean(experientialMethodOutcomeCreditResolver),
        projection: cloneJson(experientialMethodOutcomeCredit),
      },
      experiential_method_impasse_resolution_outcome_evidence:
        cloneJson(experientialMethodImpasseResolutionOutcomeEvidence),
      experiential_method_semantic_revision:
        cloneJson(experientialMethodSemanticRevision),
      experiential_method_semantic_revision_mutation_queue:
        cloneJson(experientialMethodSemanticRevisionMutationQueue),
      experiential_method_semantic_revision_mutation_execution:
        cloneJson(experientialMethodSemanticRevisionMutationExecution.execution),
      contextual_schema_refinement_evidence:
        cloneJson(contextualSchemaRefinementEvidence),
      contextual_schema_specialization_resolution: {
        version: worldSimulationContextualSchemaSpecializationVersion,
        resolver_used: Boolean(contextualSchemaSpecializationResolver),
        resolver_view_hash:
          contextualSchemaSpecializationResolverView.resolver_view_hash,
        projection: cloneJson(contextualSchemaSpecialization),
      },
      contextual_schema_specialization_admission_resolution: {
        version: worldSimulationContextualSchemaSpecializationAdmissionVersion,
        resolver_used: Boolean(contextualSchemaSpecializationAdmissionResolver),
        resolver_view_hash:
          contextualSchemaSpecializationAdmissionResolverView.resolver_view_hash,
        projection: cloneJson(contextualSchemaSpecializationAdmission),
      },
      contextual_schema_specialization_semantic_retention:
        cloneJson(contextualSchemaSpecializationSemanticRetention),
      contextual_schema_specialization_semantic_retention_mutation_queue:
        cloneJson(contextualSchemaSpecializationSemanticRetentionMutationQueue),
      contextual_schema_specialization_semantic_retention_mutation_execution:
        cloneJson(
          contextualSchemaSpecializationSemanticRetentionMutationExecution.execution,
        ),

      autobiographical_life_period_organization_decision_resolution: {
        version:
          worldSimulationAutobiographicalLifePeriodVersion,
        decisions:
          cloneJson(autobiographicalLifePeriodDecisionResolution.decisions),
        resolver_view_hash:
          autobiographicalLifePeriodDecisionResolution
            .resolver_view
            .resolver_view_hash,
        audit:
          cloneJson(autobiographicalLifePeriodDecisionResolution.audit),
      },
      autobiographical_life_period_organization:
        cloneJson(autobiographicalLifePeriodOrganization),
      autobiographical_life_period_organization_mutation_queue:
        cloneJson(autobiographicalLifePeriodMutationQueue),
      autobiographical_life_period_organization_mutation_execution:
        cloneJson(autobiographicalLifePeriodMutationExecution.execution),

      autobiographical_self_interpretation_decision_resolution: {
        version:
          worldSimulationAutobiographicalSelfInterpretationVersion,
        decisions:
          cloneJson(autobiographicalSelfInterpretationDecisionResolution.decisions),
        resolver_view_hash:
          autobiographicalSelfInterpretationDecisionResolution
            .resolver_view
            .resolver_view_hash,
        audit:
          cloneJson(autobiographicalSelfInterpretationDecisionResolution.audit),
      },
      autobiographical_self_interpretation:
        cloneJson(autobiographicalSelfInterpretation),
      autobiographical_self_interpretation_mutation_queue:
        cloneJson(autobiographicalSelfInterpretationMutationQueue),
      autobiographical_self_interpretation_mutation_execution:
        cloneJson(autobiographicalSelfInterpretationMutationExecution.execution),

      structured_self_model_decision_resolution: {
        version: worldSimulationStructuredSelfModelVersion,
        decisions: cloneJson(structuredSelfModelDecisionResolution.decisions),
        resolver_view_hash:
          structuredSelfModelDecisionResolution.resolver_view.resolver_view_hash,
        audit: cloneJson(structuredSelfModelDecisionResolution.audit),
      },
      structured_self_model:
        cloneJson(structuredSelfModel),
      structured_self_model_mutation_queue:
        cloneJson(structuredSelfModelMutationQueue),
      structured_self_model_mutation_execution:
        cloneJson(structuredSelfModelMutationExecution.execution),

      structured_self_model_revision_decision_resolution: {
        version: worldSimulationStructuredSelfModelRevisionVersion,
        decisions: cloneJson(structuredSelfModelRevisionDecisionResolution.decisions),
        resolver_view_hash:
          structuredSelfModelRevisionDecisionResolution.resolver_view.resolver_view_hash,
        audit: cloneJson(structuredSelfModelRevisionDecisionResolution.audit),
      },
      structured_self_model_revision:
        cloneJson(structuredSelfModelRevision),
      structured_self_model_revision_mutation_queue:
        cloneJson(structuredSelfModelRevisionMutationQueue),
      structured_self_model_revision_mutation_execution:
        cloneJson(structuredSelfModelRevisionMutationExecution.execution),

      experience_grounded_subjective_learning_interpretation_resolution: {
        version:
          worldSimulationExperienceGroundedSubjectiveLearningVersion,
        decisions:
          cloneJson(
            experienceGroundedSubjectiveLearningInterpretationResolution.decisions,
          ),
        claim_proposals:
          cloneJson(
            experienceGroundedSubjectiveLearningInterpretationResolution.claim_proposals,
          ),
        resolver_view_hash:
          experienceGroundedSubjectiveLearningInterpretationResolution
            .resolver_view
            .resolver_view_hash,
        audit:
          cloneJson(
            experienceGroundedSubjectiveLearningInterpretationResolution.audit,
          ),
      },
      experiential_knowledge_reentry_projections:
        cloneJson(preparedTurn.experiential_knowledge_reentry_projections ?? []),
      experiential_method_transfer_projections:
        cloneJson(preparedTurn.experiential_method_transfer_projections ?? []),
      experiential_method_competition_projections:
        cloneJson(preparedTurn.experiential_method_competition_projections ?? []),
      experiential_method_competition_resolution_projections:
        cloneJson(
          preparedTurn.experiential_method_competition_resolution_projections ?? [],
        ),
      experiential_method_competition_guidance_projections:
        cloneJson(preparedTurn.experiential_method_competition_guidance_projections ?? []),
      experiential_method_impasse_deliberation_projections:
        cloneJson(preparedTurn.experiential_method_impasse_deliberation_projections ?? []),
      experiential_method_impasse_discriminating_evidence_projections:
        cloneJson(
          preparedTurn.experiential_method_impasse_discriminating_evidence_projections ?? [],
        ),
      experiential_method_impasse_reresolution_projections:
        cloneJson(
          preparedTurn.experiential_method_impasse_reresolution_projections ?? [],
        ),
      experiential_method_impasse_precedent_reentry_projections:
        cloneJson(
          preparedTurn.experiential_method_impasse_precedent_reentry_projections ?? [],
        ),
      experiential_method_impasse_precedent_reresolution_projections:
        cloneJson(
          preparedTurn.experiential_method_impasse_precedent_reresolution_projections ?? [],
        ),
      experiential_method_candidate_attribution_projections:
        cloneJson(
          preparedTurn.experiential_method_candidate_attribution_projections ?? [],
        ),
      selected_experiential_method_application_receipts:
        cloneJson(selectedExperientialMethodApplicationReceipts),
      experiential_method_impasse_resolution_application_lineage:
        cloneJson(experientialMethodImpasseResolutionApplicationLineage),
      subjective_means_feasibility_interpretation_resolution: {
        version:
          worldSimulationSubjectiveMeansFeasibilityInterpretationVersion,
        decisions:
          cloneJson(
            subjectiveMeansFeasibilityInterpretationResolution.decisions,
          ),
        claim_proposals:
          cloneJson(
            subjectiveMeansFeasibilityInterpretationResolution.claim_proposals,
          ),
        resolver_view_hash:
          subjectiveMeansFeasibilityInterpretationResolution.resolver_view.resolver_view_hash,
        audit:
          cloneJson(
            subjectiveMeansFeasibilityInterpretationResolution.audit,
          ),
      },
      subjective_claim_proposal_resolution: {
        version:
          worldSimulationSubjectiveClaimProjectionVersion,
        proposals:
          cloneJson(
            subjectiveClaimProposalResolution.proposals,
          ),
        resolver_view_hash:
          hashAgentRunValue(
            subjectiveClaimProposalResolution.resolver_view,
          ),
        audit:
          cloneJson(
            subjectiveClaimProposalResolution.audit,
          ),
      },
      subjective_claim_projection: {
        version:
          subjectiveClaimProjection.version,
        result: {
          processed_proposal_count:
            subjectiveClaimProjection.result.processed_proposal_count,
          claim_events_created:
            cloneJson(
              subjectiveClaimProjection.result.claim_events_created,
            ),
          already_persisted_claim_event_ids:
            cloneJson(
              subjectiveClaimProjection.result.already_persisted_claim_event_ids,
            ),
          history_references_appended:
            cloneJson(
              subjectiveClaimProjection.result.history_references_appended,
            ),
          state_transitions:
            cloneJson(
              subjectiveClaimProjection.result.state_transitions,
            ),
          audit:
            cloneJson(
              subjectiveClaimProjection.result.audit,
            ),
        },
      },
      subjective_claim_mutation_queue:
        cloneJson(
          subjectiveClaimMutationQueue,
        ),
      subjective_claim_mutation_execution:
        cloneJson(
          subjectiveClaimMutationExecution.execution,
        ),
      subjective_claim_relation_proposal_resolution: {
        version:
          worldSimulationSubjectiveClaimConflictRevisionProjectionVersion,
        proposals:
          cloneJson(
            subjectiveClaimRelationProposalResolution.proposals,
          ),
        resolver_view_hash:
          hashAgentRunValue(
            subjectiveClaimRelationProposalResolution.resolver_view,
          ),
        audit:
          cloneJson(
            subjectiveClaimRelationProposalResolution.audit,
          ),
      },
      subjective_claim_conflict_revision_projection: {
        version:
          subjectiveClaimConflictRevisionProjection.version,
        result: {
          processed_proposal_count:
            subjectiveClaimConflictRevisionProjection.result.processed_proposal_count,
          relation_events_created:
            cloneJson(
              subjectiveClaimConflictRevisionProjection.result.relation_events_created,
            ),
          already_persisted_relation_event_ids:
            cloneJson(
              subjectiveClaimConflictRevisionProjection.result.already_persisted_relation_event_ids,
            ),
          history_references_appended:
            cloneJson(
              subjectiveClaimConflictRevisionProjection.result.history_references_appended,
            ),
          state_transitions:
            cloneJson(
              subjectiveClaimConflictRevisionProjection.result.state_transitions,
            ),
          audit:
            cloneJson(
              subjectiveClaimConflictRevisionProjection.result.audit,
            ),
        },
      },
      subjective_claim_relation_mutation_queue:
        cloneJson(
          subjectiveClaimRelationMutationQueue,
        ),
      subjective_claim_relation_mutation_execution:
        cloneJson(
          subjectiveClaimRelationMutationExecution.execution,
        ),
      subjective_belief_resolution: {
        version:
          subjectiveBeliefResolution.version,
        result:
          cloneJson(
            subjectiveBeliefResolution.result,
          ),
      },
      subjective_belief_revision_projection: {
        version:
          subjectiveBeliefRevision.version,
        result: {
          processed_resolution_decision_count:
            subjectiveBeliefRevision.result.processed_resolution_decision_count,
          actionable_resolution_decision_count:
            subjectiveBeliefRevision.result.actionable_resolution_decision_count,
          unresolved_resolution_decision_count:
            subjectiveBeliefRevision.result.unresolved_resolution_decision_count,
          revision_events_created:
            cloneJson(subjectiveBeliefRevision.result.revision_events_created),
          already_persisted_revision_event_ids:
            cloneJson(subjectiveBeliefRevision.result.already_persisted_revision_event_ids),
          history_references_appended:
            cloneJson(subjectiveBeliefRevision.result.history_references_appended),
          state_transitions:
            cloneJson(subjectiveBeliefRevision.result.state_transitions),
          audit:
            cloneJson(subjectiveBeliefRevision.result.audit),
        },
      },
      subjective_belief_revision_mutation_queue:
        cloneJson(subjectiveBeliefRevisionMutationQueue),
      subjective_belief_revision_mutation_execution:
        cloneJson(subjectiveBeliefRevisionMutationExecution.execution),
      subjective_means_feasibility_reconsideration:
        cloneJson(subjectiveMeansFeasibilityLinkage),
      subjective_means_feasibility_reconsideration_mutation_queue:
        cloneJson(subjectiveMeansFeasibilityLinkageMutationQueue),
      subjective_means_feasibility_reconsideration_mutation_execution:
        cloneJson(subjectiveMeansFeasibilityLinkageMutationExecution.execution),
      goal_implementation_intention_execution_feedback_decision_resolution: {
        version: worldSimulationGoalImplementationIntentionExecutionFeedbackVersion,
        decisions:
          cloneJson(implementationIntentionExecutionFeedbackDecisionResolution.decisions),
        resolver_view_hash:
          implementationIntentionExecutionFeedbackDecisionResolution
            .resolver_view
            .resolver_view_hash,
        audit:
          cloneJson(implementationIntentionExecutionFeedbackDecisionResolution.audit),
      },
      goal_implementation_intention_execution_feedback:
        cloneJson(implementationIntentionExecutionFeedback),
      goal_implementation_intention_execution_feedback_mutation_queue:
        cloneJson(implementationIntentionExecutionFeedbackMutationQueue),
      goal_implementation_intention_execution_feedback_mutation_execution:
        cloneJson(implementationIntentionExecutionFeedbackMutationExecution.execution),
      goal_achievement_decision_resolution: {
        version: worldSimulationGoalAchievementVerificationVersion,
        decisions: cloneJson(goalAchievementDecisionResolution.decisions),
        resolver_view_hash:
          goalAchievementDecisionResolution.resolver_view.resolver_view_hash,
        audit: cloneJson(goalAchievementDecisionResolution.audit),
      },
      goal_achievement_verification:
        cloneJson(goalAchievement),
      goal_achievement_mutation_queue:
        cloneJson(goalAchievementMutationQueue),
      goal_achievement_mutation_execution:
        cloneJson(goalAchievementMutationExecution.execution),
      goal_viability_decision_resolution: {
        version: worldSimulationGoalViabilityUnattainabilityVersion,
        decisions: cloneJson(goalViabilityDecisionResolution.decisions),
        resolver_view_hash:
          goalViabilityDecisionResolution.resolver_view.resolver_view_hash,
        audit: cloneJson(goalViabilityDecisionResolution.audit),
      },
      goal_viability_unattainability:
        cloneJson(goalUnattainability),
      goal_viability_unattainability_mutation_queue:
        cloneJson(goalUnattainabilityMutationQueue),
      goal_viability_unattainability_mutation_execution:
        cloneJson(goalUnattainabilityMutationExecution.execution),
      goal_adjustment_decision_resolution: {
        version: worldSimulationGoalDisengagementReengagementVersion,
        decisions: cloneJson(goalAdjustmentDecisionResolution.decisions),
        resolver_view_hash:
          goalAdjustmentDecisionResolution.resolver_view.resolver_view_hash,
        audit: cloneJson(goalAdjustmentDecisionResolution.audit),
      },
      goal_disengagement_reengagement:
        cloneJson(goalAdjustment),
      goal_disengagement_reengagement_mutation_queue:
        cloneJson(goalAdjustmentMutationQueue),
      goal_disengagement_reengagement_mutation_execution:
        cloneJson(goalAdjustmentMutationExecution.execution),
      adaptive_replanning_decision_resolution: {
        version: worldSimulationAdaptiveReplanningVersion,
        decisions: cloneJson(adaptiveReplanningDecisionResolution.decisions),
        resolver_view_hash:
          adaptiveReplanningDecisionResolution.resolver_view.resolver_view_hash,
        audit: cloneJson(adaptiveReplanningDecisionResolution.audit),
      },
      adaptive_replanning_alternative_means:
        cloneJson(adaptiveReplanning),
      adaptive_replanning_phase69b_mutation_queue:
        cloneJson(adaptiveReplanningPhase69BMutationQueue),
      adaptive_replanning_phase69b_mutation_execution:
        cloneJson(adaptiveReplanningPhase69BMutationExecution.execution),
      adaptive_replanning_mutation_queue:
        cloneJson(adaptiveReplanningMutationQueue),
      adaptive_replanning_mutation_execution:
        cloneJson(adaptiveReplanningMutationExecution.execution),
      means_feasibility_decision_resolution: {
        version: worldSimulationMeansFeasibilityVersion,
        decisions: cloneJson(meansFeasibilityDecisionResolution.decisions),
        resolver_view_hash:
          meansFeasibilityDecisionResolution.resolver_view.resolver_view_hash,
        audit: cloneJson(meansFeasibilityDecisionResolution.audit),
      },
      means_feasibility_capability_affordance:
        cloneJson(meansFeasibility),
      means_feasibility_mutation_queue:
        cloneJson(meansFeasibilityMutationQueue),
      means_feasibility_mutation_execution:
        cloneJson(meansFeasibilityMutationExecution.execution),
      visible_constraint_observation:
        cloneJson(visibleConstraintObservation),
      visible_constraint_observation_mutation_queue:
        cloneJson(visibleConstraintObservationMutationQueue),
      visible_constraint_observation_mutation_execution:
        cloneJson(visibleConstraintObservationMutationExecution.execution),
      committed_character_current_mind_projection:
        cloneJson(committedCharacterCurrentMindProjection),
      post_outcome_subjective_perception_projection:
        cloneJson(postOutcomeSubjectivePerceptionProjection),
      post_outcome_subjective_memory_bridge:
        cloneJson(postOutcomeSubjectiveMemoryBridge),
      post_outcome_subjective_memory_formation:
        cloneJson(postOutcomeSubjectiveMemoryFormation),
      post_outcome_subjective_memory_mutation_queue:
        cloneJson(postOutcomeSubjectiveMemoryMutationQueue),
      post_outcome_subjective_memory_mutation_execution:
        cloneJson(postOutcomeSubjectiveMemoryMutationExecution.execution),
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
    subjective_choice_commitment_receipt: {
      version: worldSimulationSubjectiveChoiceCommitmentReceiptVersion,
      receipt_count: subjectiveChoiceCommitmentReceipts.receipt_count,
      receipt_bundle_hash: subjectiveChoiceCommitmentReceipts.receipt_bundle_hash,
      established_only_with_successful_world_commit: true,
      receipt_records_intent_not_outcome: true,
      causal_outcome_authority_claimed: false,
    },
    consistency,

    subjective_cognition_read_projection: {
      version:
        worldSimulationSubjectiveCognitionProjectionVersion,
      character_projection_count:
        array(preparedTurn.subjective_cognition_projections).length,
      committed_prior_turn_only:
        true,
      action_proposer_exposure_installed:
        true,
      character_brain_exposure_installed:
        true,
      same_turn_claim_feedback_allowed:
        false,
      world_truth_authority_exposed:
        false,
      confidence_probability_exposed:
        false,
      claim_evidence_exposed:
        false,
      candidate_supersession_is_truth_resolution:
        false,
    },

    subjective_belief_character_projection: {
      version:
        worldSimulationSubjectiveBeliefCharacterProjectionVersion,
      character_projection_count:
        array(preparedTurn.subjective_belief_character_projections).length,
      source_scope:
        "same_character_committed_prior_turn_effective_subjective_beliefs_only",
      action_proposer_exposure_installed:
        true,
      character_brain_exposure_installed:
        true,
      active_beliefs_only:
        true,
      superseded_beliefs_exposed:
        false,
      same_turn_revision_feedback_allowed:
        false,
      claim_revision_identity_exposed:
        false,
      world_truth_authority_exposed:
        false,
      confidence_probability_exposed:
        false,
      duplicate_active_claim_count_used_as_credibility:
        false,
    },

    experiential_knowledge_reentry: {
      version: worldSimulationExperientialKnowledgeReentryVersion,
      character_projection_count:
        array(preparedTurn.experiential_knowledge_reentry_projections).length,
      activated_knowledge_count:
        array(preparedTurn.experiential_knowledge_reentry_projections)
          .reduce((total, item) => total + array(item?.activated_semantics).length, 0),
      source_scope: "same_character_committed_prior_turn_phase67c_only",
      cue_dependent: true,
      current_mind_admission_output_gating_reused: true,
      resolver_authors_semantic_content: false,
      exact_case_replay_required: false,
      current_context_revalidation_required: true,
      direct_action_selection: false,
      direct_plan_or_goal_mutation: false,
      direct_subjective_belief_write: false,
      world_truth_authority_exposed: false,
      confidence_probability_modeled: false,
    },

    experiential_method_transfer: {
      version: worldSimulationExperientialMethodTransferVersion,
      character_projection_count:
        array(preparedTurn.experiential_method_transfer_projections).length,
      transferred_method_count:
        array(preparedTurn.experiential_method_transfer_projections)
          .reduce((total, item) => total + array(item?.transferred_method_mappings).length, 0),
      source_scope: "same_turn_verified_phase76d_recalled_recurring_experience_only",
      relational_structure_transfer_only: true,
      current_context_cue_grounding_required: true,
      action_proposer_guidance_installed: true,
      phase74_deliberation_grounding_reused: true,
      exact_case_replay_required: false,
      exact_action_replay_allowed: false,
      current_context_revalidation_required: true,
      adaptation_before_use_required: true,
      direct_action_selection: false,
      direct_plan_or_goal_mutation: false,
      direct_subjective_belief_write: false,
      world_truth_authority_exposed: false,
      numeric_similarity_confidence_probability_utility_modeled: false,
    },

    experiential_method_application_lineage: {
      version: worldSimulationExperientialMethodApplicationLineageVersion,
      character_projection_count:
        array(preparedTurn.experiential_method_candidate_attribution_projections).length,
      candidate_attribution_count:
        array(preparedTurn.experiential_method_candidate_attribution_projections)
          .reduce(
            (total, item) => total + Number(item?.candidate_attribution_count ?? 0),
            0,
          ),
      selected_application_receipt_count:
        selectedExperientialMethodApplicationReceipts.receipt_count,
      source_phase74d_receipt_bundle_hash:
        selectedExperientialMethodApplicationReceipts.source_phase74d_receipt_bundle_hash,
      explicit_method_to_candidate_lineage: true,
      selected_application_requires_matching_phase74d_action_ref: true,
      candidate_attribution_is_causal_credit: false,
      method_caused_selection_claimed: false,
      outcome_consumed: false,
      action_outcome_credit_assigned: false,
      success_failure_learning_performed: false,
      retain_revise_policy_modeled: false,
      direct_action_selection: false,
      world_truth_authority_exposed: false,
      numeric_strength_confidence_probability_utility_modeled: false,
      persisted_only_with_successful_world_commit: true,
    },

    experiential_method_outcome_credit: {
      version: worldSimulationExperientialMethodOutcomeCreditVersion,
      resolver_used: Boolean(experientialMethodOutcomeCreditResolver),
      assessment_count: experientialMethodOutcomeCredit.assessment_count,
      semantic_revision_decision_count:
        experientialMethodOutcomeCredit.semantic_decision_count,
      projection_hash: experientialMethodOutcomeCredit.projection_hash,
      source_phase76f_receipt_bundle_hash:
        experientialMethodOutcomeCredit.source_phase76f_receipt_bundle_hash,
      bounded_subjective_outcome_only: true,
      durable_semantic_revision_owner: "Phase67C",
      objective_causation_claimed: false,
      numeric_credit_assigned: false,
      success_failure_auto_credit_allowed: false,
      same_turn_character_brain_feedback_allowed: false,
      persisted_only_with_successful_world_commit: true,
    },

    contextual_schema_refinement_evidence: {
      version: worldSimulationContextualSchemaRefinementEvidenceVersion,
      refinement_candidate_count:
        contextualSchemaRefinementEvidence.refinement_candidate_count,
      evidence_hash: contextualSchemaRefinementEvidence.evidence_hash,
      source_phase67c_projection_hash:
        contextualSchemaRefinementEvidence.source_phase67c_projection_hash,
      source_phase77a_evidence_view_hash:
        contextualSchemaRefinementEvidence.source_phase77a_evidence_view_hash,
      contested_recurring_event_pattern_only: true,
      current_turn_counterevidence_required: true,
      support_and_counterexample_evidence_separated: true,
      semantic_rewrite_performed: false,
      specialized_schema_authored: false,
      durable_semantic_write_performed: false,
      future_refinement_owner: "Phase78B",
      same_turn_character_brain_feedback_allowed: false,
      persisted_only_with_successful_world_commit: true,
    },
    contextual_schema_specialization: {
      version: worldSimulationContextualSchemaSpecializationVersion,
      resolver_used: Boolean(contextualSchemaSpecializationResolver),
      proposal_count: contextualSchemaSpecialization.proposal_count,
      projection_hash: contextualSchemaSpecialization.projection_hash,
      source_phase78a_evidence_hash:
        contextualSchemaSpecialization.source_phase78a_evidence_hash,
      additive_narrowing_qualifiers_only: true,
      source_contested_state_preserved: true,
      proposal_only: true,
      durable_semantic_write_performed: false,
      phase67c_durable_semantic_owner: true,
      same_turn_character_brain_feedback_allowed: false,
      persisted_only_with_successful_world_commit: true,
    },
    contextual_schema_specialization_admission: {
      version: worldSimulationContextualSchemaSpecializationAdmissionVersion,
      resolver_used: Boolean(contextualSchemaSpecializationAdmissionResolver),
      admission_decision_count:
        contextualSchemaSpecializationAdmission.admission_decision_count,
      emitted_phase67c_semantic_decision_count:
        contextualSchemaSpecializationAdmission.emitted_phase67c_semantic_decision_count,
      projection_hash: contextualSchemaSpecializationAdmission.projection_hash,
      source_phase78a_evidence_hash:
        contextualSchemaSpecializationAdmission.source_phase78a_evidence_hash,
      source_phase78b_projection_hash:
        contextualSchemaSpecializationAdmission.source_phase78b_projection_hash,
      explicit_admission_required: true,
      source_contested_state_preserved: true,
      source_history_rewrite_performed: false,
      strict_narrowing_required: true,
      phase67c_durable_semantic_owner: true,
      direct_durable_semantic_write_performed: false,
      same_turn_character_brain_feedback_allowed: false,
      persisted_only_with_successful_world_commit: true,
    },

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

    subjective_memory_plasticity: {
      version:
        worldSimulationMemoryPlasticityVersion,
      source_retrieval_event_count:
        subjectiveMemoryPlasticity
          .result
          .processed_retrieval_event_ids
          .length,
      created_plasticity_event_count:
        subjectiveMemoryPlasticity
          .result
          .plasticity_events_created
          .length,
      appended_history_reference_count:
        subjectiveMemoryPlasticity
          .result
          .history_references_appended
          .length,
      mutation_count:
        subjectiveMemoryPlasticityMutationQueue
          .mutation_count,
      authoritative_executor:
        subjectiveMemoryPlasticityMutationExecution
          .execution
          .version,
      same_turn_feedback_allowed:
        false,
    },

    subjective_memory_formation: {
      version: worldSimulationSubjectiveMemoryFormationVersion,
      created_memory_count: subjectiveMemoryFormation.result.created_memory_count,
      mutation_count: subjectiveMemoryMutationQueue.mutation_count,
      authoritative_executor: subjectiveMemoryMutationExecution.execution.version,
    },
    post_outcome_subjective_memory: {
      bridge_version:
        worldSimulationPostOutcomeSubjectiveMemoryBridgeVersion,
      source_phase76a_projection_hash:
        postOutcomeSubjectiveMemoryBridge.source_phase76a_projection_hash,
      source_experience_count:
        postOutcomeSubjectiveMemoryBridge.source_entries.length,
      created_memory_count:
        postOutcomeSubjectiveMemoryFormation.result.created_memory_count,
      mutation_count:
        postOutcomeSubjectiveMemoryMutationQueue.mutation_count,
      authoritative_executor:
        postOutcomeSubjectiveMemoryMutationExecution.execution.version,
      existing_phase63_formation_reused: true,
      existing_phase65_phase66_pipeline_reused: true,
      raw_world_outcome_exposed_to_memory: false,
      direct_subjective_claim_or_belief_write: false,
      same_turn_character_brain_feedback_allowed: false,
    },
    experience_grounded_subjective_learning: {
      version:
        worldSimulationExperienceGroundedSubjectiveLearningVersion,
      interpreter_used:
        experienceGroundedSubjectiveLearningInterpretationResolution
          .audit
          .interpreter_used === true,
      eligible_character_count:
        experienceGroundedSubjectiveLearningInterpretationResolution
          .audit
          .eligible_character_count,
      eligible_experience_memory_count:
        experienceGroundedSubjectiveLearningInterpretationResolution
          .audit
          .eligible_experience_memory_count,
      interpretation_decision_count:
        experienceGroundedSubjectiveLearningInterpretationResolution.decisions.length,
      emitted_phase65_claim_proposal_count:
        experienceGroundedSubjectiveLearningInterpretationResolution.claim_proposals.length,
      single_experience_current_situation_scope: true,
      proposition_text_engine_scoped: true,
      multi_experience_generalization_applied: false,
      global_trait_or_capability_inference_applied: false,
      existing_phase65_phase66_pipeline_reused: true,
      parallel_belief_store_created: false,
      numeric_reward_or_q_value_modeled: false,
      raw_world_outcome_exposed: false,
      direct_subjective_belief_write: false,
      direct_current_mind_write: false,
      same_turn_character_brain_feedback_allowed: false,
    },
    subjective_episode_segmentation: {
      version: worldSimulationSubjectiveEpisodeSegmentationVersion,
      processed_source_memory_count:
        subjectiveEpisodeSegmentation.result.processed_source_memory_count,
      new_source_memory_count:
        subjectiveEpisodeSegmentation.result.new_source_memory_count,
      created_segmentation_event_count:
        subjectiveEpisodeSegmentation.result.segmentation_events_created.length,
      appended_history_reference_count:
        subjectiveEpisodeSegmentation.result.history_references_appended.length,
      effective_episode_projection_hash:
        subjectiveEpisodeSegmentation.result.effective_episode_projection.projection_hash,
      mutation_count:
        subjectiveEpisodeSegmentationMutationQueue.mutation_count,
      authoritative_executor:
        subjectiveEpisodeSegmentationMutationExecution.execution.version,
      phase63_memory_rewritten: false,
      world_truth_authority_claimed: false,
      same_turn_character_brain_feedback_allowed: false,
    },
    autobiographical_life_event_organization: {
      version:
        worldSimulationAutobiographicalLifeEventVersion,
      resolver_used:
        autobiographicalLifeEventOrganizationDecisionResolution
          .audit
          .resolver_used === true,
      processed_source_segmentation_event_count:
        autobiographicalLifeEventOrganization
          .result
          .processed_source_segmentation_event_count,
      created_organization_event_count:
        autobiographicalLifeEventOrganization
          .result
          .organization_events_created
          .length,
      appended_history_reference_count:
        autobiographicalLifeEventOrganization
          .result
          .history_references_appended
          .length,
      effective_life_event_projection_hash:
        autobiographicalLifeEventOrganization
          .result
          .effective_life_event_projection
          .projection_hash,
      mutation_count:
        autobiographicalLifeEventOrganizationMutationQueue
          .mutation_count,
      authoritative_executor:
        autobiographicalLifeEventOrganizationMutationExecution
          .execution
          .version,
      one_primary_parent_per_subjective_episode:
        true,
      repeated_event_categories_modeled:
        false,
      personal_semantic_memory_modeled:
        false,
      episode_content_copied:
        false,
      memory_content_copied:
        false,
      world_truth_authority_claimed:
        false,
      same_turn_character_brain_feedback_allowed:
        false,
    },
    multi_experience_schema_evidence: {
      version: worldSimulationMultiExperienceSchemaEvidenceVersion,
      ready_character_count: multiExperienceSchemaEvidence.ready_character_count,
      character_context_count:
        multiExperienceSchemaEvidence.resolver_view.character_contexts.length,
      evidence_item_count: multiExperienceSchemaEvidence.internal_lineage.length,
      evidence_view_hash: multiExperienceSchemaEvidence.evidence_view_hash,
      current_turn_phase67b_anchor_required: true,
      same_character_only: true,
      individual_episode_specificity_preserved: true,
      relational_alignment_performed: false,
      schema_induction_performed: false,
      recurrence_count_auto_promotes_schema: false,
      phase67c_durable_semantic_owner: true,
      internal_lineage_exposed_to_future_aligner: false,
      world_truth_authority_claimed: false,
      numeric_similarity_confidence_probability_modeled: false,
      same_turn_character_brain_feedback_allowed: false,
      persisted_only_with_successful_world_commit: true,
    },
    relational_schema_induction: {
      version: worldSimulationRelationalSchemaInductionVersion,
      resolver_used: Boolean(relationalSchemaInductionResolver),
      proposal_count: relationalSchemaInduction.proposal_count,
      projection_hash: relationalSchemaInduction.projection_hash,
      source_phase77a_evidence_view_hash:
        relationalSchemaInduction.source_phase77a_evidence_view_hash,
      same_character_only: true,
      current_anchor_and_prior_evidence_required: true,
      one_to_one_evidence_mapping_required: true,
      exact_experience_index_required: true,
      parallel_connectivity_required: true,
      systematicity_action_result_grounding_required: true,
      proposal_only: true,
      durable_semantic_write_performed: false,
      phase67c_durable_semantic_owner: true,
      phase77c_promotion_owner: true,
      recurrence_count_auto_promotes_schema: false,
      surface_similarity_alone_is_sufficient: false,
      world_truth_authority_claimed: false,
      numeric_similarity_confidence_probability_modeled: false,
      same_turn_character_brain_feedback_allowed: false,
      persisted_only_with_successful_world_commit: true,
    },
    relational_schema_promotion: {
      version: worldSimulationRelationalSchemaPromotionVersion,
      resolver_used: Boolean(relationalSchemaPromotionResolver),
      promotion_decision_count: relationalSchemaPromotion.promotion_decision_count,
      emitted_phase67c_semantic_decision_count:
        relationalSchemaPromotion.emitted_phase67c_semantic_decision_count,
      projection_hash: relationalSchemaPromotion.projection_hash,
      source_phase77b_projection_hash:
        relationalSchemaPromotion.source_phase77b_projection_hash,
      explicit_programmatic_promotion_required: true,
      descriptor_truncation_or_rewrite_used: false,
      exact_existing_descriptor_match_may_support: true,
      fuzzy_similarity_auto_merge_used: false,
      recurrence_count_auto_promoted: false,
      phase67c_durable_semantic_owner_preserved: true,
      direct_durable_semantic_write_performed: false,
      world_truth_authority_claimed: false,
      numeric_similarity_confidence_probability_modeled: false,
      same_turn_character_brain_feedback_allowed: false,
      persisted_only_with_successful_world_commit: true,
    },
    personal_semantic_memory: {
      version:
        worldSimulationPersonalSemanticMemoryVersion,
      resolver_used:
        personalSemanticDecisionResolution.audit.resolver_used === true,
      semantic_decision_count:
        personalSemanticMemoryDerivation.result.semantic_decision_count
        + relationalSchemaPromotion.emitted_phase67c_semantic_decision_count
        + experientialMethodOutcomeCredit.semantic_decision_count
        + contextualSchemaSpecializationAdmission.emitted_phase67c_semantic_decision_count,
      ordinary_semantic_decision_count:
        personalSemanticMemoryDerivation.result.semantic_decision_count,
      relational_schema_promotion_decision_count:
        relationalSchemaPromotion.emitted_phase67c_semantic_decision_count,
      experiential_method_revision_decision_count:
        experientialMethodOutcomeCredit.semantic_decision_count,
      contextual_schema_specialization_admission_decision_count:
        contextualSchemaSpecializationAdmission.emitted_phase67c_semantic_decision_count,
      created_derivation_event_count:
        personalSemanticMemoryDerivation.result.derivation_events_created.length
        + relationalSchemaSemanticPromotion.result.derivation_events_created.length
        + experientialMethodSemanticRevision.result.derivation_events_created.length
        + contextualSchemaSpecializationSemanticRetention.result.derivation_events_created.length,
      appended_history_reference_count:
        personalSemanticMemoryDerivation.result.history_references_appended.length
        + relationalSchemaSemanticPromotion.result.history_references_appended.length
        + experientialMethodSemanticRevision.result.history_references_appended.length
        + contextualSchemaSpecializationSemanticRetention.result.history_references_appended.length,
      effective_personal_semantic_projection_hash:
        contextualSchemaSpecializationSemanticRetention
          .result
          .effective_personal_semantic_projection
          .projection_hash,
      mutation_count:
        personalSemanticMemoryMutationQueue.mutation_count
        + relationalSchemaSemanticPromotionMutationQueue.mutation_count
        + experientialMethodSemanticRevisionMutationQueue.mutation_count
        + contextualSchemaSpecializationSemanticRetentionMutationQueue.mutation_count,
      authoritative_executor:
        contextualSchemaSpecializationSemanticRetentionMutationExecution.execution.version,
      experience_near_only: true,
      eager_semanticization_used: false,
      recurring_event_pattern_auto_promoted_by_count: false,
      trait_inference_modeled: false,
      role_identity_modeled: false,
      self_model_modeled: false,
      belief_engine_duplicated: false,
      world_truth_authority_claimed: false,
      confidence_probability_modeled: false,
      same_turn_character_brain_feedback_allowed: false,
    },
    autobiographical_life_period_organization: {
      version:
        worldSimulationAutobiographicalLifePeriodVersion,
      resolver_used:
        autobiographicalLifePeriodDecisionResolution.audit.resolver_used === true,
      organization_decision_count:
        autobiographicalLifePeriodOrganization.result.organization_decision_count,
      created_organization_event_count:
        autobiographicalLifePeriodOrganization.result.organization_events_created.length,
      appended_history_reference_count:
        autobiographicalLifePeriodOrganization.result.history_references_appended.length,
      effective_life_period_projection_hash:
        autobiographicalLifePeriodOrganization
          .result
          .effective_life_period_projection
          .projection_hash,
      mutation_count:
        autobiographicalLifePeriodMutationQueue.mutation_count,
      authoritative_executor:
        autobiographicalLifePeriodMutationExecution.execution.version,
      overlapping_periods_allowed: true,
      many_to_many_life_event_membership: true,
      one_primary_period_parent_per_life_event: false,
      temporal_adjacency_membership_authority: false,
      calendar_bucket_membership_authority: false,
      fixed_duration_threshold_modeled: false,
      cultural_life_script_assumptions_used: false,
      world_truth_authority_claimed: false,
      confidence_probability_modeled: false,
      same_turn_character_brain_feedback_allowed: false,
    },
    autobiographical_self_interpretation: {
      version:
        worldSimulationAutobiographicalSelfInterpretationVersion,
      resolver_used:
        autobiographicalSelfInterpretationDecisionResolution.audit.resolver_used === true,
      interpretation_decision_count:
        autobiographicalSelfInterpretation.result.interpretation_decision_count,
      created_interpretation_event_count:
        autobiographicalSelfInterpretation.result.interpretation_events_created.length,
      appended_history_reference_count:
        autobiographicalSelfInterpretation.result.history_references_appended.length,
      effective_self_interpretation_projection_hash:
        autobiographicalSelfInterpretation
          .result
          .effective_self_interpretation_projection
          .projection_hash,
      mutation_count:
        autobiographicalSelfInterpretationMutationQueue.mutation_count,
      authoritative_executor:
        autobiographicalSelfInterpretationMutationExecution.execution.version,
      same_character_autobiographical_evidence_only: true,
      current_turn_phase67_trigger_required: true,
      explicit_supersession_only: true,
      multiple_active_interpretations_allowed: true,
      max_one_durable_event_per_character_per_turn: true,
      last_write_wins_applied: false,
      mandatory_narrative_coherence_applied: false,
      self_model_modeled: false,
      trait_value_preference_role_capability_goal_inference_modeled: false,
      freeform_life_story_authority_used: false,
      world_truth_authority_claimed: false,
      confidence_probability_modeled: false,
      same_turn_character_brain_feedback_allowed: false,
    },
    structured_self_model: {
      version: worldSimulationStructuredSelfModelVersion,
      resolver_used: structuredSelfModelDecisionResolution.audit.resolver_used === true,
      aspect_decision_count: structuredSelfModel.result.aspect_decision_count,
      created_aspect_event_count: structuredSelfModel.result.aspect_events_created.length,
      appended_history_reference_count: structuredSelfModel.result.history_references_appended.length,
      effective_structured_self_model_projection_hash:
        structuredSelfModel.result.effective_structured_self_model_projection.projection_hash,
      mutation_count: structuredSelfModelMutationQueue.mutation_count,
      authoritative_executor: structuredSelfModelMutationExecution.execution.version,
      same_character_phase68a_evidence_only: true,
      current_turn_phase68a_trigger_required: true,
      formation_only: true,
      revision_applied: false,
      last_write_wins_applied: false,
      forced_cross_domain_consistency_applied: false,
      self_model_accuracy_claimed: false,
      self_model_clarity_claimed: false,
      numeric_personality_capability_scores_modeled: false,
      motivation_goal_selection_modeled: false,
      world_truth_authority_claimed: false,
      confidence_probability_modeled: false,
      same_turn_character_brain_feedback_allowed: false,
    },
    structured_self_model_revision: {
      version: worldSimulationStructuredSelfModelRevisionVersion,
      resolver_used:
        structuredSelfModelRevisionDecisionResolution.audit.resolver_used === true,
      revision_decision_count:
        structuredSelfModelRevision.result.revision_decision_count,
      created_revision_event_count:
        structuredSelfModelRevision.result.revision_events_created.length,
      appended_history_reference_count:
        structuredSelfModelRevision.result.history_references_appended.length,
      effective_revised_structured_self_model_projection_hash:
        structuredSelfModelRevision
          .result
          .effective_revised_structured_self_model_projection
          .projection_hash,
      mutation_count: structuredSelfModelRevisionMutationQueue.mutation_count,
      authoritative_executor:
        structuredSelfModelRevisionMutationExecution.execution.version,
      support_preserves_active_state: true,
      challenge_preserves_active_state: true,
      revise_explicitly_supersedes_targets: true,
      unresolved_challenges_may_coexist: true,
      last_write_wins_applied: false,
      forced_global_coherence_applied: false,
      neighboring_aspect_propagation_applied: false,
      self_model_accuracy_claimed: false,
      self_model_clarity_claimed: false,
      motivation_goal_selection_modeled: false,
      world_truth_authority_claimed: false,
      confidence_probability_modeled: false,
      same_turn_character_brain_feedback_allowed: false,
    },
    subjective_means_feasibility_interpretation: {
      version:
        worldSimulationSubjectiveMeansFeasibilityInterpretationVersion,
      interpreter_used:
        subjectiveMeansFeasibilityInterpretationResolution.audit.interpreter_used === true,
      eligible_character_count:
        subjectiveMeansFeasibilityInterpretationResolution.audit.eligible_character_count,
      eligible_constraint_memory_count:
        subjectiveMeansFeasibilityInterpretationResolution.audit.eligible_constraint_memory_count,
      interpretation_decision_count:
        subjectiveMeansFeasibilityInterpretationResolution.decisions.length,
      emitted_phase65_claim_proposal_count:
        subjectiveMeansFeasibilityInterpretationResolution.claim_proposals.length,
      task_and_situation_specific:
        true,
      phase72_actual_means_status_exposed:
        false,
      phase73a_source_means_binding_exposed:
        false,
      parallel_belief_store_created:
        false,
      direct_subjective_belief_write:
        false,
      same_turn_phase71_consumes_new_interpretation:
        false,
      numeric_confidence_probability_modeled:
        false,
    },
    subjective_claim_projection: {
      version:
        worldSimulationSubjectiveClaimProjectionVersion,
      resolver_used:
        subjectiveClaimProposalResolution
          .audit
          .resolver_used === true,
      processed_proposal_count:
        subjectiveClaimProjection
          .result
          .processed_proposal_count,
      created_claim_event_count:
        subjectiveClaimProjection
          .result
          .claim_events_created
          .length,
      appended_history_reference_count:
        subjectiveClaimProjection
          .result
          .history_references_appended
          .length,
      mutation_count:
        subjectiveClaimMutationQueue
          .mutation_count,
      authoritative_executor:
        subjectiveClaimMutationExecution
          .execution
          .version,
      same_turn_character_brain_feedback_allowed:
        false,
      confidence_probability_modeled:
        false,
      belief_revision_modeled:
        false,
    },
    subjective_claim_conflict_revision_projection: {
      version:
        worldSimulationSubjectiveClaimConflictRevisionProjectionVersion,
      resolver_used:
        subjectiveClaimRelationProposalResolution
          .audit
          .resolver_used === true,
      processed_proposal_count:
        subjectiveClaimConflictRevisionProjection
          .result
          .processed_proposal_count,
      created_relation_event_count:
        subjectiveClaimConflictRevisionProjection
          .result
          .relation_events_created
          .length,
      appended_history_reference_count:
        subjectiveClaimConflictRevisionProjection
          .result
          .history_references_appended
          .length,
      mutation_count:
        subjectiveClaimRelationMutationQueue
          .mutation_count,
      authoritative_executor:
        subjectiveClaimRelationMutationExecution
          .execution
          .version,
      same_turn_character_brain_feedback_allowed:
        false,
      confidence_probability_modeled:
        false,
      truth_resolution_applied:
        false,
      historical_claim_mutation_allowed:
        false,
      unresolved_competing_claims_preserved:
        true,
    },
    subjective_belief_resolution: {
      version:
        worldSimulationSubjectiveBeliefResolutionVersion,
      decision_count:
        subjectiveBeliefResolution
          .result
          .decision_count,
      unresolved_decision_count:
        subjectiveBeliefResolution
          .result
          .audit
          .unresolved_decision_count,
      pure_resolution:
        true,
      durable_belief_revision_persisted:
        false,
      world_truth_authority_claimed:
        false,
      confidence_probability_modeled:
        false,
      last_write_wins_applied:
        false,
      same_turn_character_brain_feedback_allowed:
        false,
      phase66_required_for_durable_revision:
        true,
    },
    subjective_belief_revision: {
      version:
        worldSimulationSubjectiveBeliefRevisionVersion,
      processed_resolution_decision_count:
        subjectiveBeliefRevision.result.processed_resolution_decision_count,
      actionable_resolution_decision_count:
        subjectiveBeliefRevision.result.actionable_resolution_decision_count,
      unresolved_resolution_decision_count:
        subjectiveBeliefRevision.result.unresolved_resolution_decision_count,
      created_revision_event_count:
        subjectiveBeliefRevision.result.revision_events_created.length,
      appended_history_reference_count:
        subjectiveBeliefRevision.result.history_references_appended.length,
      mutation_count:
        subjectiveBeliefRevisionMutationQueue.mutation_count,
      authoritative_executor:
        subjectiveBeliefRevisionMutationExecution.execution.version,
      unresolved_decision_persisted:
        false,
      effective_belief_projection_applied:
        false,
      same_turn_character_brain_feedback_allowed:
        false,
      world_truth_authority_claimed:
        false,
      confidence_probability_modeled:
        false,
    },
    subjective_means_feasibility_reconsideration: {
      version:
        worldSimulationSubjectiveMeansFeasibilityReconsiderationVersion,
      created_linkage_event_count:
        subjectiveMeansFeasibilityLinkage.result.linkage_events_created.length,
      appended_history_reference_count:
        subjectiveMeansFeasibilityLinkage.result.history_references_appended.length,
      mutation_count:
        subjectiveMeansFeasibilityLinkageMutationQueue.mutation_count,
      authoritative_executor:
        subjectiveMeansFeasibilityLinkageMutationExecution.execution.version,
      semantic_linkage_only: true,
      phase66_belief_authority_preserved: true,
      prior_committed_only_for_phase71_trigger: true,
      perceived_blocked_may_trigger_later_turn_reconsideration: true,
      uncertain_auto_triggers_reconsideration: false,
      perceived_feasible_auto_triggers_reconsideration: false,
      direct_plan_or_goal_mutation: false,
      same_turn_replanning_allowed: false,
      objective_feasibility_verified: false,
    },
    goal_implementation_intention_execution_feedback: {
      version:
        worldSimulationGoalImplementationIntentionExecutionFeedbackVersion,
      resolver_used:
        implementationIntentionExecutionFeedbackDecisionResolution.audit.resolver_used === true,
      feedback_decision_count:
        implementationIntentionExecutionFeedback.result.feedback_decision_count,
      created_feedback_event_count:
        implementationIntentionExecutionFeedback.result.execution_feedback_events_created.length,
      appended_history_reference_count:
        implementationIntentionExecutionFeedback.result.history_references_appended.length,
      effective_execution_projection_hash:
        implementationIntentionExecutionFeedback.result.effective_execution_projection.projection_hash,
      mutation_count:
        implementationIntentionExecutionFeedbackMutationQueue.mutation_count,
      authoritative_executor:
        implementationIntentionExecutionFeedbackMutationExecution.execution.version,
      prior_turn_committed_plan_state_only: true,
      authoritative_action_outcome_evidence_only: true,
      explicit_completion_required: true,
      completed_plan_history_preserved: true,
      action_success_implies_plan_completion: false,
      plan_completion_implies_goal_achievement: false,
      goal_achievement_authority_claimed: false,
      action_selection_authority_claimed: false,
      numeric_scoring_modeled: false,
    },
    goal_achievement_verification: {
      version: worldSimulationGoalAchievementVerificationVersion,
      resolver_used:
        goalAchievementDecisionResolution.audit.resolver_used === true,
      achievement_decision_count:
        goalAchievement.result.achievement_decision_count,
      created_achievement_event_count:
        goalAchievement.result.achievement_events_created.length,
      appended_history_reference_count:
        goalAchievement.result.history_references_appended.length,
      effective_goal_lifecycle_projection_hash:
        goalAchievement.result.effective_goal_lifecycle_projection.projection_hash,
      mutation_count:
        goalAchievementMutationQueue.mutation_count,
      authoritative_executor:
        goalAchievementMutationExecution.execution.version,
      prior_turn_committed_goal_state_only: true,
      authoritative_current_turn_evidence_only: true,
      explicit_goal_condition_verification_required: true,
      action_success_implies_goal_achievement: false,
      plan_fulfillment_implies_goal_achievement: false,
      plan_completion_implies_goal_achievement: false,
      failure_or_unattainability_modeled: false,
      numeric_scoring_modeled: false,
    },
    goal_viability_unattainability: {
      version: worldSimulationGoalViabilityUnattainabilityVersion,
      resolver_used:
        goalViabilityDecisionResolution.audit.resolver_used === true,
      unattainability_decision_count:
        goalUnattainability.result.unattainability_decision_count,
      created_unattainability_event_count:
        goalUnattainability.result.unattainability_events_created.length,
      appended_history_reference_count:
        goalUnattainability.result.history_references_appended.length,
      effective_goal_viability_projection_hash:
        goalUnattainability.result.effective_goal_viability_projection.projection_hash,
      mutation_count:
        goalUnattainabilityMutationQueue.mutation_count,
      authoritative_executor:
        goalUnattainabilityMutationExecution.execution.version,
      prior_turn_committed_goal_state_only: true,
      authoritative_current_turn_evidence_only: true,
      explicit_unattainability_verification_required: true,
      structural_authoritative_evidence_required: true,
      action_outcome_only_sufficient: false,
      action_failure_alone_sufficient: false,
      plan_failure_alone_sufficient: false,
      lack_of_progress_alone_sufficient: false,
      unattainability_is_abandonment: false,
      automatic_disengagement: false,
      automatic_reengagement: false,
      automatic_replanning: false,
      numeric_scoring_modeled: false,
    },
    goal_disengagement_reengagement: {
      version: worldSimulationGoalDisengagementReengagementVersion,
      resolver_used:
        goalAdjustmentDecisionResolution.audit.resolver_used === true,
      adjustment_decision_count:
        goalAdjustment.result.adjustment_decision_count,
      created_adjustment_event_count:
        goalAdjustment.result.adjustment_events_created.length,
      appended_history_reference_count:
        goalAdjustment.result.history_references_appended.length,
      effective_goal_adjustment_projection_hash:
        goalAdjustment.result.effective_goal_adjustment_projection.projection_hash,
      mutation_count:
        goalAdjustmentMutationQueue.mutation_count,
      authoritative_executor:
        goalAdjustmentMutationExecution.execution.version,
      prior_turn_committed_goal_state_only: true,
      phase70b_unattainability_required_for_disengagement: true,
      unattainability_implies_disengagement: false,
      action_failure_implies_disengagement: false,
      plan_failure_implies_disengagement: false,
      lack_of_progress_implies_disengagement: false,
      reengagement_requires_prior_committed_disengagement: true,
      same_turn_disengage_reengage_allowed: false,
      same_goal_reengagement_allowed: false,
      alternative_goal_must_already_be_committed: true,
      new_goal_creation_modeled: false,
      goal_commitment_creation_modeled: false,
      automatic_replanning: false,
      numeric_scoring_modeled: false,
    },
    adaptive_replanning_alternative_means: {
      version: worldSimulationAdaptiveReplanningVersion,
      candidate_provider_used:
        adaptiveReplanningDecisionResolution.audit.provider_used === true,
      resolver_used:
        adaptiveReplanningDecisionResolution.audit.resolver_used === true,
      replanning_decision_count:
        adaptiveReplanning.result.replanning_decision_count,
      created_replanning_event_count:
        adaptiveReplanning.result.adaptive_replanning_events_created.length,
      created_phase69b_revision_event_count:
        adaptiveReplanning.result.phase69b_revision_events_created.length,
      appended_history_reference_count:
        adaptiveReplanning.result.history_references_appended.length,
      effective_adaptive_replanning_projection_hash:
        adaptiveReplanning.result.effective_adaptive_replanning_projection.projection_hash,
      phase69b_revision_mutation_count:
        adaptiveReplanningPhase69BMutationQueue.mutation_count,
      mutation_count:
        adaptiveReplanningMutationQueue.mutation_count,
      authoritative_executor:
        adaptiveReplanningMutationExecution.execution.version,
      same_goal_preserved: true,
      phase69b_revision_owns_plan_lifecycle: true,
      prior_turn_committed_failure_evidence_only: true,
      minimum_consecutive_failure_turns: 2,
      single_action_failure_sufficient: false,
      single_plan_failure_event_sufficient: false,
      bounded_candidate_membership_required: true,
      bounded_character_means_grounding_catalog_required: true,
      candidate_character_cognition_grounding_required: true,
      replace_means_requires_grounding_beyond_failed_current_means: true,
      provider_arbitrary_world_state_search_available: false,
      new_goal_creation_modeled: false,
      automatic_goal_abandonment_modeled: false,
      goal_unattainability_verification_modeled: false,
      goal_disengagement_reengagement_modeled: false,
      arbitrary_world_state_search_modeled: false,
      numeric_scoring_modeled: false,
    },
    means_feasibility_capability_affordance: {
      version: worldSimulationMeansFeasibilityVersion,
      evaluator_used:
        meansFeasibilityDecisionResolution.audit.evaluator_used === true,
      feasibility_decision_count:
        meansFeasibility.result.feasibility_decision_count,
      created_feasibility_event_count:
        meansFeasibility.result.means_feasibility_events_created.length,
      appended_history_reference_count:
        meansFeasibility.result.history_references_appended.length,
      effective_means_feasibility_projection_hash:
        meansFeasibility.result.effective_means_feasibility_projection.projection_hash,
      mutation_count:
        meansFeasibilityMutationQueue.mutation_count,
      authoritative_executor:
        meansFeasibilityMutationExecution.execution.version,
      post_phase71_effective_plan_state_used: true,
      bounded_current_turn_engine_evidence_catalog_only: true,
      complete_coverage_required_to_claim_feasible: true,
      physical_executability_required_to_claim_feasible: true,
      physical_executability_separate_from_authorization: true,
      character_visible_evidence_explicit_subset_only: true,
      world_truth_auto_updates_character_knowledge: false,
      means_blocked_implies_goal_unattainable: false,
      means_blocked_implies_plan_abandonment: false,
      alternative_means_generation_modeled: false,
      same_turn_replanning_modeled: false,
      arbitrary_world_state_search_modeled: false,
      numeric_scoring_modeled: false,
    },
    visible_constraint_observation: {
      version: worldSimulationVisibleConstraintObservationVersion,
      created_observation_event_count:
        visibleConstraintObservation.result.observation_events_created.length,
      appended_history_reference_count:
        visibleConstraintObservation.result.history_references_appended.length,
      mutation_count:
        visibleConstraintObservationMutationQueue.mutation_count,
      authoritative_executor:
        visibleConstraintObservationMutationExecution.execution.version,
      phase72_character_visible_subset_only: true,
      observer_scoped: true,
      next_committed_revision_only: true,
      actual_means_feasibility_verdict_exposed: false,
      world_truth_authority_exposed: false,
      direct_subjective_memory_write: false,
      direct_subjective_claim_or_belief_write: false,
      direct_current_mind_write: false,
      same_turn_cognition_feedback_allowed: false,
      same_turn_replanning_triggered: false,
      cross_character_exposure_allowed: false,
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
