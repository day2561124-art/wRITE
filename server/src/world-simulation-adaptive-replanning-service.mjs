import { hashAgentRunValue } from "./agent-run-service.mjs";
import {
  buildWorldSimulationGoalImplementationIntentionRevisions,
  projectWorldSimulationEffectiveRevisedGoalImplementationIntentions,
} from "./world-simulation-goal-implementation-intention-revision-service.mjs";
import {
  projectWorldSimulationEffectiveGoalImplementationIntentionExecution,
} from "./world-simulation-goal-implementation-intention-execution-feedback-service.mjs";
import {
  projectWorldSimulationEffectiveMotivationalGoalAdjustment,
} from "./world-simulation-goal-disengagement-reengagement-service.mjs";
import {
  projectWorldSimulationEffectiveRevisedStructuredSelfModel,
} from "./world-simulation-structured-self-model-revision-service.mjs";
import {
  projectWorldSimulationEffectiveSubjectiveBeliefs,
} from "./world-simulation-effective-subjective-belief-projection-service.mjs";
import {
  projectWorldSimulationSubjectiveMeansReconsiderationTriggers,
} from "./world-simulation-subjective-means-feasibility-reconsideration-service.mjs";

export const worldSimulationAdaptiveReplanningVersion =
  "phase71-adaptive-replanning-alternative-means-v1";
export const adaptiveReplanningEventSchemaVersion =
  "phase71-goal-implementation-intention-adaptive-replanning-event-v1";
export const adaptiveReplanningHistoryReferenceSchemaVersion =
  "phase71-goal-implementation-intention-adaptive-replanning-history-ref-v1";
export const effectiveAdaptiveReplanningProjectionVersion =
  "phase71-effective-adaptive-replanning-projection-v1";

const supportedCandidateKinds = ["repair_existing_means", "replace_means"];
const supportedCueKinds = ["situation", "opportunity", "obstacle", "task_juncture", "internal_state"];
const supportedResponseKinds = ["initiate_behavior", "cognitive_procedure", "communication", "avoidance", "seek_support"];
const minimumConsecutiveFailureTurns = 2;
const maximumFailureEvidenceRefs = 8;
const maximumCandidates = 32;
const maximumMeansGroundingRefsPerCandidate = 8;
const maximumMeansGroundingsPerSource = 32;

function isObject(value) { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function object(value) { return isObject(value) ? value : {}; }
function array(value) { return Array.isArray(value) ? value : []; }
function cloneJson(value) { return JSON.parse(JSON.stringify(value ?? null)); }
function optionalString(value) { return typeof value === "string" && value.trim() ? value.trim() : null; }
function boundedString(value, label, maxLength = 240, code = "WORLD_SIMULATION_ADAPTIVE_REPLANNING_INPUT_INVALID") {
  const text = optionalString(value);
  if (!text || text.length > maxLength) {
    const error = new Error(`${label} must be a non-empty string no longer than ${maxLength} characters.`);
    error.code = code;
    throw error;
  }
  return text;
}
function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}
function characterKey(value) { return String(value ?? "").trim().toLocaleLowerCase("zh-Hant-TW"); }
function sameCharacter(left, right) { return characterKey(left) === characterKey(right); }
function compareText(left, right) { return String(left ?? "").localeCompare(String(right ?? ""), "en"); }
function sameValue(left, right) { return JSON.stringify(left ?? null) === JSON.stringify(right ?? null); }
function eventHash(event, hashField) {
  const body = cloneJson(event);
  delete body[hashField];
  return hashAgentRunValue(body);
}
function normalizeCue(value) {
  const cue = object(value);
  const cueKind = boundedString(cue.cue_kind, "replacement_cue_descriptor.cue_kind", 80);
  if (!supportedCueKinds.includes(cueKind)) {
    const error = new Error(`Unsupported Phase71 cue kind ${cueKind}.`);
    error.code = "WORLD_SIMULATION_ADAPTIVE_REPLANNING_CANDIDATE_INVALID";
    throw error;
  }
  return {
    cue_kind: cueKind,
    label: boundedString(cue.label, "replacement_cue_descriptor.label", 240),
    context: optionalString(cue.context)?.slice(0, 480) ?? null,
  };
}
function normalizeResponse(value) {
  const response = object(value);
  const responseKind = boundedString(response.response_kind, "replacement_response_descriptor.response_kind", 80);
  if (!supportedResponseKinds.includes(responseKind)) {
    const error = new Error(`Unsupported Phase71 response kind ${responseKind}.`);
    error.code = "WORLD_SIMULATION_ADAPTIVE_REPLANNING_CANDIDATE_INVALID";
    throw error;
  }
  return {
    response_kind: responseKind,
    label: boundedString(response.label, "replacement_response_descriptor.label", 240),
    context: optionalString(response.context)?.slice(0, 480) ?? null,
  };
}
function findCharacterRecords(container, character) {
  const entry = Object.entries(object(container)).find(([name]) => sameCharacter(name, character));
  return object(entry?.[1]);
}
function feedbackEventHash(event) {
  return eventHash(event, "execution_feedback_event_hash");
}
function replanningEventHash(event) {
  return eventHash(event, "adaptive_replanning_event_hash");
}
function latestPlanSource(worldState, character, planId) {
  const revisions = array(worldState.goal_implementation_intention_revision_history);
  for (let index = revisions.length - 1; index >= 0; index -= 1) {
    const ref = revisions[index];
    const event = object(object(worldState.goal_implementation_intention_revision_events)[ref?.revision_event_id]);
    if (event.operation === "revise"
        && sameCharacter(event.character, character)
        && event.replacement_implementation_intention_id === planId) {
      return {
        target_source_kind: "phase69b_goal_implementation_intention_revision_event",
        target_source_event_id: event.revision_event_id,
        target_source_event_hash: event.revision_event_hash,
      };
    }
  }
  for (const ref of array(worldState.goal_implementation_intention_history)) {
    const event = object(object(worldState.goal_implementation_intention_events)[ref?.implementation_intention_event_id]);
    if (sameCharacter(event.character, character) && event.implementation_intention_id === planId) {
      return {
        target_source_kind: "phase69a_goal_implementation_intention_event",
        target_source_event_id: event.implementation_intention_event_id,
        target_source_event_hash: event.implementation_intention_event_hash,
      };
    }
  }
  return null;
}
function canonicalPlanFeedback(worldState, character, planId, goalId) {
  // The effective Phase69D replay performs the complete canonical history validation first.
  projectWorldSimulationEffectiveGoalImplementationIntentionExecution({ world_state: worldState });
  const events = object(worldState.goal_implementation_intention_execution_feedback_events);
  const matched = [];
  for (const ref of array(worldState.goal_implementation_intention_execution_feedback_history)) {
    const event = object(events[ref?.execution_feedback_event_id]);
    if (!sameCharacter(event.character, character)
        || event.implementation_intention_id !== planId
        || event.goal_id !== goalId) continue;
    if (feedbackEventHash(event) !== event.execution_feedback_event_hash
        || ref.execution_feedback_event_hash !== event.execution_feedback_event_hash) {
      const error = new Error(`Phase71 found non-canonical Phase69D feedback ${ref?.execution_feedback_event_id ?? "<missing>"}.`);
      error.code = "WORLD_SIMULATION_ADAPTIVE_REPLANNING_FAILURE_EVIDENCE_INVALID";
      throw error;
    }
    matched.push(event);
  }
  return matched;
}
function trailingFailureEvidence(worldState, character, planId, goalId, excludedTurnId = null) {
  const events = canonicalPlanFeedback(worldState, character, planId, goalId)
    .filter((event) => !excludedTurnId || event.source_turn_id !== excludedTurnId);
  const trailing = [];
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event.operation !== "failed") break;
    trailing.unshift(event);
    if (trailing.length >= maximumFailureEvidenceRefs) break;
  }
  const distinctTurns = new Set(trailing.map((event) => event.source_turn_id));
  if (trailing.length < minimumConsecutiveFailureTurns || distinctTurns.size < minimumConsecutiveFailureTurns) return [];
  return trailing;
}
function validateReplanningHistory(worldState) {
  const events = object(worldState.goal_implementation_intention_adaptive_replanning_events);
  const history = array(worldState.goal_implementation_intention_adaptive_replanning_history);
  const latestByCharacter = new Map();
  const replannedSources = new Set();
  const seen = new Set();
  for (const ref of history) {
    if (!isObject(ref)
        || ref.schema_version !== adaptiveReplanningHistoryReferenceSchemaVersion
        || ref.derived_index !== true
        || !optionalString(ref.adaptive_replanning_event_id)
        || seen.has(ref.adaptive_replanning_event_id)) {
      const error = new Error("Phase71 adaptive-replanning history contains an invalid or duplicate reference.");
      error.code = "WORLD_SIMULATION_ADAPTIVE_REPLANNING_HISTORY_REFERENCE_INVALID";
      throw error;
    }
    const event = object(events[ref.adaptive_replanning_event_id]);
    if (!Object.keys(event).length
        || event.schema_version !== adaptiveReplanningEventSchemaVersion
        || event.version !== worldSimulationAdaptiveReplanningVersion
        || event.immutable !== true
        || event.adaptive_replanning_event_id !== ref.adaptive_replanning_event_id
        || replanningEventHash(event) !== event.adaptive_replanning_event_hash
        || ref.adaptive_replanning_event_hash !== event.adaptive_replanning_event_hash
        || ref.character !== event.character
        || ref.source_turn_id !== event.source_turn_id
        || ref.goal_id !== event.goal_id
        || ref.source_implementation_intention_id !== event.source_implementation_intention_id
        || ref.replacement_implementation_intention_id !== event.replacement_implementation_intention_id
        || ref.previous_adaptive_replanning_event_id !== event.previous_adaptive_replanning_event_id
        || ref.previous_adaptive_replanning_event_hash !== event.previous_adaptive_replanning_event_hash) {
      const error = new Error(`Phase71 history reference ${ref.adaptive_replanning_event_id} does not match its immutable event.`);
      error.code = "WORLD_SIMULATION_ADAPTIVE_REPLANNING_HISTORY_REFERENCE_INVALID";
      throw error;
    }
    const key = characterKey(event.character);
    const previous = latestByCharacter.get(key) ?? null;
    if (event.previous_adaptive_replanning_event_id !== (previous?.adaptive_replanning_event_id ?? null)
        || event.previous_adaptive_replanning_event_hash !== (previous?.adaptive_replanning_event_hash ?? null)) {
      const error = new Error(`Phase71 event ${event.adaptive_replanning_event_id} breaks its per-character chain.`);
      error.code = "WORLD_SIMULATION_ADAPTIVE_REPLANNING_EVENT_CHAIN_INVALID";
      throw error;
    }
    const sourceKey = `${key}\u0000${event.source_implementation_intention_id}`;
    if (replannedSources.has(sourceKey)) {
      const error = new Error(`Phase71 source plan ${event.source_implementation_intention_id} was adaptively replanned more than once.`);
      error.code = "WORLD_SIMULATION_ADAPTIVE_REPLANNING_SOURCE_ALREADY_REPLANNED";
      throw error;
    }
    seen.add(event.adaptive_replanning_event_id);
    replannedSources.add(sourceKey);
    latestByCharacter.set(key, event);
  }
  return { events, history, latestByCharacter, replannedSources, seen };
}
function eligibleSourceRecords(worldState, turnId) {
  const execution = projectWorldSimulationEffectiveGoalImplementationIntentionExecution({ world_state: worldState });
  const adjustment = projectWorldSimulationEffectiveMotivationalGoalAdjustment({ world_state: worldState });
  const existing = validateReplanningHistory(worldState);
  const subjectiveReconsideration = projectWorldSimulationSubjectiveMeansReconsiderationTriggers({
    world_state: worldState,
    current_turn_id: turnId,
  });
  const subjectiveByPlan = new Map(
    array(subjectiveReconsideration.triggers).map((trigger) => [
      `${characterKey(trigger.character)}\u0000${trigger.goal_id}\u0000${trigger.source_implementation_intention_id}`,
      trigger,
    ]),
  );
  const sources = [];
  for (const [character, records] of Object.entries(execution.plans_by_character ?? {})) {
    const goals = findCharacterRecords(adjustment.goals_by_character, character);
    for (const plan of Object.values(object(records))) {
      const sourceKey = `${characterKey(character)}\u0000${plan.implementation_intention_id}`;
      const goal = goals[plan.goal_id];
      if (!goal
          || goal.state !== "committed"
          || goal.achieved === true
          || goal.unattainable === true
          || goal.disengaged === true
          || !["active", "challenged"].includes(plan.state)
          || plan.completed === true
          || existing.replannedSources.has(sourceKey)) continue;
      const failures = trailingFailureEvidence(
        worldState,
        character,
        plan.implementation_intention_id,
        plan.goal_id,
        turnId,
      );
      const failureRefs = failures.map((event) => ({
        execution_feedback_event_id: event.execution_feedback_event_id,
        execution_feedback_event_hash: event.execution_feedback_event_hash,
        source_turn_id: event.source_turn_id,
        operation: event.operation,
      }));
      const subjectiveTrigger = subjectiveByPlan.get(
        `${characterKey(character)}\u0000${plan.goal_id}\u0000${plan.implementation_intention_id}`,
      ) ?? null;
      const hasRepeatedFailure = failures.length >= minimumConsecutiveFailureTurns;
      if (!hasRepeatedFailure && !subjectiveTrigger) continue;
      const eligibilityBasis = hasRepeatedFailure
        ? "repeated_committed_failure"
        : "committed_subjective_means_block";
      const planSource = latestPlanSource(worldState, character, plan.implementation_intention_id);
      if (!planSource) continue;
      const descriptor = {
        character,
        goal_id: plan.goal_id,
        source_implementation_intention_id: plan.implementation_intention_id,
        source_plan_state: plan.state,
        source_execution_state: plan.execution_state,
        cue_descriptor: cloneJson(plan.cue_descriptor),
        response_descriptor: cloneJson(plan.response_descriptor),
        target_source_kind: planSource.target_source_kind,
        target_source_event_id: planSource.target_source_event_id,
        target_source_event_hash: planSource.target_source_event_hash,
        eligibility_basis: eligibilityBasis,
        consecutive_failure_count: failureRefs.length,
        failure_evidence_refs: failureRefs,
        subjective_reconsideration_trigger_refs:
          eligibilityBasis === "committed_subjective_means_block" && subjectiveTrigger
            ? [{
              trigger_ref: subjectiveTrigger.trigger_ref,
              trigger_hash: subjectiveTrigger.trigger_hash,
              trigger_kind: subjectiveTrigger.trigger_kind,
              assessment: subjectiveTrigger.assessment,
              active_blocked_linkage_refs: cloneJson(subjectiveTrigger.active_blocked_linkage_refs),
            }]
            : [],
      };
      sources.push({
        source_plan_ref: `phase71_source_${hashAgentRunValue({
          version: worldSimulationAdaptiveReplanningVersion,
          turn_id: turnId,
          descriptor,
        }).slice(0, 24)}`,
        ...descriptor,
      });
    }
  }
  sources.sort((left, right) => compareText(characterKey(left.character), characterKey(right.character))
    || compareText(left.goal_id, right.goal_id)
    || compareText(left.source_implementation_intention_id, right.source_implementation_intention_id));
  return sources;
}
function groundingRecord(base) {
  const groundingHash = hashAgentRunValue({
    version: worldSimulationAdaptiveReplanningVersion,
    grounding: base,
  });
  return {
    grounding_ref: `phase71_grounding_${groundingHash.slice(0, 24)}`,
    grounding_hash: groundingHash,
    ...base,
  };
}
function groundingPriority(kind) {
  if (kind === "current_implementation_intention") return 0;
  if (kind === "represented_same_goal_means") return 1;
  if (kind === "active_capability_appraisal") return 2;
  if (kind === "active_subjective_belief") return 3;
  return 9;
}
function buildMeansGroundingCatalog(worldState, sources) {
  const executionPlans = projectWorldSimulationEffectiveGoalImplementationIntentionExecution({
    world_state: worldState,
  });
  const selfModel = projectWorldSimulationEffectiveRevisedStructuredSelfModel({
    world_state: worldState,
  });
  const catalog = [];
  for (const source of sources) {
    const sourceGroundings = [];
    sourceGroundings.push(groundingRecord({
      source_plan_ref: source.source_plan_ref,
      character: source.character,
      goal_id: source.goal_id,
      grounding_kind: "current_implementation_intention",
      source_event_kind: source.target_source_kind,
      source_event_id: source.target_source_event_id,
      source_event_hash: source.target_source_event_hash,
      character_view: {
        cue_descriptor: cloneJson(source.cue_descriptor),
        response_descriptor: cloneJson(source.response_descriptor),
        represented_means_only: true,
      },
    }));

    const characterPlans = findCharacterRecords(executionPlans.plans_by_character, source.character);
    for (const plan of Object.values(characterPlans)) {
      if (plan.goal_id !== source.goal_id
          || plan.implementation_intention_id === source.source_implementation_intention_id
          || !["active", "challenged", "suspended"].includes(plan.state)
          || plan.completed === true) continue;
      const planSource = latestPlanSource(worldState, source.character, plan.implementation_intention_id);
      if (!planSource) continue;
      sourceGroundings.push(groundingRecord({
        source_plan_ref: source.source_plan_ref,
        character: source.character,
        goal_id: source.goal_id,
        grounding_kind: "represented_same_goal_means",
        source_event_kind: planSource.target_source_kind,
        source_event_id: planSource.target_source_event_id,
        source_event_hash: planSource.target_source_event_hash,
        character_view: {
          cue_descriptor: cloneJson(plan.cue_descriptor),
          response_descriptor: cloneJson(plan.response_descriptor),
          reconsideration_state: plan.state,
          represented_means_only: true,
        },
      }));
    }

    const characterAspects = findCharacterRecords(selfModel.aspects_by_character, source.character);
    for (const aspect of Object.values(characterAspects)) {
      if (aspect.state !== "active" || aspect.aspect_type !== "capability_appraisal") continue;
      let sourceEventKind = null;
      let sourceEventId = null;
      let sourceEventHash = null;
      if (optionalString(aspect.established_by_revision_event_id)) {
        const event = object(
          object(worldState.structured_self_model_revision_events)[aspect.established_by_revision_event_id],
        );
        sourceEventKind = "phase68c_capability_appraisal_revision";
        sourceEventId = event.revision_event_id ?? null;
        sourceEventHash = event.revision_event_hash ?? null;
      } else if (optionalString(aspect.established_by_aspect_event_id)) {
        const event = object(
          object(worldState.structured_self_model_aspect_events)[aspect.established_by_aspect_event_id],
        );
        sourceEventKind = "phase68b_capability_appraisal";
        sourceEventId = event.aspect_event_id ?? null;
        sourceEventHash = event.aspect_event_hash ?? null;
      }
      if (!optionalString(sourceEventId) || !optionalString(sourceEventHash)) continue;
      sourceGroundings.push(groundingRecord({
        source_plan_ref: source.source_plan_ref,
        character: source.character,
        goal_id: source.goal_id,
        grounding_kind: "active_capability_appraisal",
        source_event_kind: sourceEventKind,
        source_event_id: sourceEventId,
        source_event_hash: sourceEventHash,
        character_view: {
          descriptor: cloneJson(aspect.descriptor),
          subjective_not_world_truth: true,
          self_model_accuracy_claimed: false,
        },
      }));
    }

    const beliefs = projectWorldSimulationEffectiveSubjectiveBeliefs({
      world_state: worldState,
      character: source.character,
    });
    for (const belief of array(beliefs?.projection?.active_beliefs)) {
      if (!optionalString(belief.claim_event_id)
          || !optionalString(belief.claim_event_hash)
          || !optionalString(belief.latest_revision_event_id)
          || !optionalString(belief.latest_revision_event_hash)) continue;
      sourceGroundings.push(groundingRecord({
        source_plan_ref: source.source_plan_ref,
        character: source.character,
        goal_id: source.goal_id,
        grounding_kind: "active_subjective_belief",
        source_event_kind: "phase66b_active_subjective_belief",
        source_event_id: belief.claim_event_id,
        source_event_hash: belief.claim_event_hash,
        governance_event_id: belief.latest_revision_event_id,
        governance_event_hash: belief.latest_revision_event_hash,
        character_view: {
          proposition: cloneJson(belief.proposition),
          subjective_not_world_truth: true,
        },
      }));
    }

    sourceGroundings.sort((left, right) => groundingPriority(left.grounding_kind) - groundingPriority(right.grounding_kind)
      || compareText(left.grounding_ref, right.grounding_ref));
    catalog.push(...sourceGroundings.slice(0, maximumMeansGroundingsPerSource));
  }
  return catalog;
}
function normalizeCandidate(raw, sources, groundingCatalog, index) {
  if (!isObject(raw)) {
    const error = new Error(`Phase71 alternative-means candidate at index ${index} must be an object.`);
    error.code = "WORLD_SIMULATION_ADAPTIVE_REPLANNING_CANDIDATE_INVALID";
    throw error;
  }
  const sourcePlanRef = boundedString(
    raw.source_plan_ref,
    "candidate.source_plan_ref",
    180,
    "WORLD_SIMULATION_ADAPTIVE_REPLANNING_CANDIDATE_SOURCE_INVALID",
  );
  const source = sources.find((entry) => entry.source_plan_ref === sourcePlanRef);
  if (!source) {
    const error = new Error(`Phase71 candidate references unknown source plan ${sourcePlanRef}.`);
    error.code = "WORLD_SIMULATION_ADAPTIVE_REPLANNING_CANDIDATE_SOURCE_INVALID";
    throw error;
  }
  const candidateKind = boundedString(raw.candidate_kind, "candidate.candidate_kind", 80);
  if (!supportedCandidateKinds.includes(candidateKind)) {
    const error = new Error(`Unsupported Phase71 candidate kind ${candidateKind}.`);
    error.code = "WORLD_SIMULATION_ADAPTIVE_REPLANNING_CANDIDATE_INVALID";
    throw error;
  }
  const cue = normalizeCue(raw.replacement_cue_descriptor);
  const response = normalizeResponse(raw.replacement_response_descriptor);
  if (sameValue(cue, source.cue_descriptor) && sameValue(response, source.response_descriptor)) {
    const error = new Error("Phase71 adaptive replanning requires different means; an unchanged cue/response pair is not a replacement.");
    error.code = "WORLD_SIMULATION_ADAPTIVE_REPLANNING_UNCHANGED_MEANS_FORBIDDEN";
    throw error;
  }
  const meansGroundingRefs = [...new Set(array(raw.means_grounding_refs).map((ref, refIndex) =>
    boundedString(
      ref,
      `candidate.means_grounding_refs[${refIndex}]`,
      180,
      "WORLD_SIMULATION_ADAPTIVE_REPLANNING_GROUNDING_INVALID",
    )))];
  if (meansGroundingRefs.length < 1 || meansGroundingRefs.length > maximumMeansGroundingRefsPerCandidate) {
    const error = new Error("Phase71 candidate must cite a bounded non-empty set of character-cognition grounding refs.");
    error.code = "WORLD_SIMULATION_ADAPTIVE_REPLANNING_GROUNDING_INVALID";
    throw error;
  }
  const groundings = meansGroundingRefs.map((groundingRef) => {
    const grounding = groundingCatalog.find((entry) => entry.grounding_ref === groundingRef);
    if (!grounding || grounding.source_plan_ref !== sourcePlanRef || !sameCharacter(grounding.character, source.character)) {
      const error = new Error(`Phase71 grounding ${groundingRef} is outside the bounded same-character source catalog.`);
      error.code = "WORLD_SIMULATION_ADAPTIVE_REPLANNING_GROUNDING_OUT_OF_CONTEXT";
      throw error;
    }
    return grounding;
  });
  if (candidateKind === "replace_means"
      && groundings.every((grounding) => grounding.grounding_kind === "current_implementation_intention")) {
    const error = new Error("Phase71 replace_means requires character-grounded support beyond the repeatedly failed current means.");
    error.code = "WORLD_SIMULATION_ADAPTIVE_REPLANNING_REPLACEMENT_GROUNDING_INSUFFICIENT";
    throw error;
  }
  const base = {
    source_plan_ref: sourcePlanRef,
    character: source.character,
    goal_id: source.goal_id,
    source_implementation_intention_id: source.source_implementation_intention_id,
    candidate_kind: candidateKind,
    replacement_cue_descriptor: cue,
    replacement_response_descriptor: response,
    means_grounding_refs: meansGroundingRefs.sort(compareText),
    means_grounding_kinds: [...new Set(groundings.map((grounding) => grounding.grounding_kind))].sort(compareText),
    candidate_source: "programmatic_bounded_character_means_provider",
    bounded_source_view_only: true,
    character_cognition_grounded: true,
    arbitrary_world_state_search_used: false,
    objective_feasibility_verified: false,
    utility_score: null,
    success_probability: null,
  };
  const candidateHash = hashAgentRunValue({
    version: worldSimulationAdaptiveReplanningVersion,
    ...base,
  });
  return {
    candidate_ref: `phase71_candidate_${candidateHash.slice(0, 24)}`,
    candidate_hash: candidateHash,
    ...base,
  };
}

export function buildWorldSimulationAdaptiveReplanningResolverView(input = {}) {
  const worldState = cloneJson(object(input.world_state));
  const turnId = boundedString(input.turn_id, "turn_id");
  const sources = eligibleSourceRecords(worldState, turnId);
  const meansGroundingCatalog = buildMeansGroundingCatalog(worldState, sources);
  const rawCandidates = array(input.alternative_means_candidates);
  if (rawCandidates.length > maximumCandidates) {
    const error = new Error(`Phase71 accepts at most ${maximumCandidates} bounded alternative-means candidates per turn.`);
    error.code = "WORLD_SIMULATION_ADAPTIVE_REPLANNING_CANDIDATE_LIMIT_EXCEEDED";
    throw error;
  }
  const candidates = rawCandidates.map((candidate, index) =>
    normalizeCandidate(candidate, sources, meansGroundingCatalog, index));
  const seenRefs = new Set();
  for (const candidate of candidates) {
    if (seenRefs.has(candidate.candidate_ref)) {
      const error = new Error(`Duplicate Phase71 alternative-means candidate ${candidate.candidate_ref}.`);
      error.code = "WORLD_SIMULATION_ADAPTIVE_REPLANNING_CANDIDATE_DUPLICATE";
      throw error;
    }
    seenRefs.add(candidate.candidate_ref);
  }
  candidates.sort((left, right) => compareText(left.source_plan_ref, right.source_plan_ref)
    || compareText(left.candidate_ref, right.candidate_ref));
  const view = {
    version: worldSimulationAdaptiveReplanningVersion,
    turn_id: turnId,
    eligible_source_plans: sources,
    means_grounding_catalog: meansGroundingCatalog,
    alternative_means_candidates: candidates,
    supported_operation: "replan_same_goal",
    supported_candidate_kinds: [...supportedCandidateKinds],
    minimum_consecutive_failure_turns: minimumConsecutiveFailureTurns,
    provider_may_propose_only_for_listed_source_plan_refs: true,
    provider_receives_only_bounded_character_means_grounding_catalog: true,
    candidate_must_cite_character_means_grounding_refs: true,
    replace_means_requires_grounding_beyond_failed_current_means: true,
    resolver_may_select_only_source_and_candidate_refs: true,
    same_goal_preserved: true,
    single_action_failure_sufficient: false,
    single_plan_failure_event_sufficient: false,
    prior_committed_failure_evidence_only: true,
    prior_committed_subjective_block_belief_may_also_trigger: true,
    uncertain_subjective_assessment_auto_triggers: false,
    perceived_feasible_subjective_assessment_auto_triggers: false,
    same_turn_subjective_belief_feedback_allowed: false,
    new_goal_creation_requested: false,
    goal_state_mutation_requested: false,
    goal_unattainability_judgment_requested: false,
    goal_disengagement_requested: false,
    raw_world_state_exposed: false,
    raw_world_event_exposed: false,
    raw_memory_store_exposed: false,
    hidden_retrieval_graph_exposed: false,
    executable_action_ids_exposed: false,
    numeric_scoring_requested: false,
  };
  view.resolver_view_hash = hashAgentRunValue(view);
  return deepFreeze(view);
}
function authoritativeValidationContext(resolverView) {
  const context = {
    version: worldSimulationAdaptiveReplanningVersion,
    turn_id: resolverView.turn_id,
    resolver_view_hash: resolverView.resolver_view_hash,
    eligible_source_plans: cloneJson(resolverView.eligible_source_plans),
    means_grounding_catalog: cloneJson(resolverView.means_grounding_catalog),
    alternative_means_candidates: cloneJson(resolverView.alternative_means_candidates),
    minimum_consecutive_failure_turns: minimumConsecutiveFailureTurns,
    bounded_prior_committed_failure_catalog: true,
    bounded_prior_committed_subjective_reconsideration_catalog: true,
    subjective_block_belief_is_alternative_eligibility_basis: true,
    same_turn_subjective_belief_feedback_allowed: false,
    bounded_character_means_grounding_catalog: true,
    bounded_candidate_membership_required: true,
    raw_world_state_exposed: false,
  };
  context.context_hash = hashAgentRunValue(context);
  return deepFreeze(context);
}
function normalizeDecision(raw, resolverView) {
  if (!isObject(raw)) {
    const error = new Error("Phase71 adaptive-replanning decision must be an object.");
    error.code = "WORLD_SIMULATION_ADAPTIVE_REPLANNING_DECISION_INVALID";
    throw error;
  }
  const sourcePlanRef = boundedString(raw.source_plan_ref, "source_plan_ref", 180);
  const candidateRef = boundedString(raw.candidate_ref, "candidate_ref", 180);
  const source = resolverView.eligible_source_plans.find((entry) => entry.source_plan_ref === sourcePlanRef);
  const candidate = resolverView.alternative_means_candidates.find((entry) => entry.candidate_ref === candidateRef);
  if (!source || !candidate || candidate.source_plan_ref !== sourcePlanRef) {
    const error = new Error("Phase71 decision must select a canonical candidate belonging to the selected canonical source plan.");
    error.code = "WORLD_SIMULATION_ADAPTIVE_REPLANNING_DECISION_OUT_OF_CONTEXT";
    throw error;
  }
  return { source, candidate };
}
function historyReferenceFor(event) {
  return deepFreeze({
    schema_version: adaptiveReplanningHistoryReferenceSchemaVersion,
    derived_index: true,
    adaptive_replanning_event_id: event.adaptive_replanning_event_id,
    adaptive_replanning_event_hash: event.adaptive_replanning_event_hash,
    character: event.character,
    source_turn_id: event.source_turn_id,
    goal_id: event.goal_id,
    source_implementation_intention_id: event.source_implementation_intention_id,
    replacement_implementation_intention_id: event.replacement_implementation_intention_id,
    previous_adaptive_replanning_event_id: event.previous_adaptive_replanning_event_id,
    previous_adaptive_replanning_event_hash: event.previous_adaptive_replanning_event_hash,
    status: event.status,
  });
}
function adaptiveEventFor(decision, revisionEvent, previous, turnId, resolverViewHash) {
  const source = decision.source;
  const candidate = decision.candidate;
  const base = {
    schema_version: adaptiveReplanningEventSchemaVersion,
    version: worldSimulationAdaptiveReplanningVersion,
    immutable: true,
    character: source.character,
    source_turn_id: turnId,
    operation: "replan_same_goal",
    goal_id: source.goal_id,
    source_plan_ref: source.source_plan_ref,
    source_implementation_intention_id: source.source_implementation_intention_id,
    target_source_kind: revisionEvent.target_source_kind,
    target_source_event_id: revisionEvent.target_source_event_id,
    target_source_event_hash: revisionEvent.target_source_event_hash,
    eligibility_basis: source.eligibility_basis,
    failure_evidence_refs: cloneJson(source.failure_evidence_refs),
    consecutive_failure_count: source.failure_evidence_refs.length,
    subjective_reconsideration_trigger_refs:
      cloneJson(source.subjective_reconsideration_trigger_refs),
    alternative_means_candidate_ref: candidate.candidate_ref,
    alternative_means_candidate_hash: candidate.candidate_hash,
    candidate_kind: candidate.candidate_kind,
    replacement_cue_descriptor: cloneJson(candidate.replacement_cue_descriptor),
    replacement_response_descriptor: cloneJson(candidate.replacement_response_descriptor),
    means_grounding_refs: cloneJson(candidate.means_grounding_refs),
    means_grounding_kinds: cloneJson(candidate.means_grounding_kinds),
    character_cognition_grounded: true,
    bounded_character_means_grounding_catalog_only: true,
    replacement_means_not_invented_from_raw_world_state: true,
    resulting_revision_event_id: revisionEvent.revision_event_id,
    resulting_revision_event_hash: revisionEvent.revision_event_hash,
    replacement_implementation_intention_id: revisionEvent.replacement_implementation_intention_id,
    resolver_view_hash: resolverViewHash,
    previous_adaptive_replanning_event_id: previous?.adaptive_replanning_event_id ?? null,
    previous_adaptive_replanning_event_hash: previous?.adaptive_replanning_event_hash ?? null,
    same_goal_preserved: true,
    new_goal_created: false,
    goal_state_mutated: false,
    goal_unattainability_asserted: false,
    goal_disengagement_asserted: false,
    single_action_failure_sufficient: false,
    single_plan_failure_event_sufficient: false,
    repeated_prior_failure_required:
      source.eligibility_basis === "repeated_committed_failure",
    committed_subjective_means_block_sufficient:
      source.eligibility_basis === "committed_subjective_means_block",
    prior_committed_failure_evidence_only: true,
    prior_committed_subjective_belief_only: true,
    same_turn_subjective_belief_feedback_allowed: false,
    phase69b_revision_is_plan_lifecycle_authority: true,
    objective_feasibility_verified: false,
    arbitrary_world_state_search_used: false,
    utility_score: null,
    priority_score: null,
    success_probability: null,
    feasibility_score: null,
    character_brain_direct_write: false,
    status: "goal_implementation_intention_adaptive_replanning_recorded",
  };
  const eventId = `goal_implementation_intention_adaptive_replanning_event_${hashAgentRunValue({
    version: worldSimulationAdaptiveReplanningVersion,
    character: characterKey(source.character),
    source_turn_id: turnId,
    source_implementation_intention_id: source.source_implementation_intention_id,
    replacement_implementation_intention_id: revisionEvent.replacement_implementation_intention_id,
    eligibility_basis: source.eligibility_basis,
    failure_evidence_refs: source.failure_evidence_refs,
    subjective_reconsideration_trigger_refs:
      source.subjective_reconsideration_trigger_refs,
    candidate_hash: candidate.candidate_hash,
    previous_adaptive_replanning_event_hash: previous?.adaptive_replanning_event_hash ?? null,
  }).slice(0, 24)}`;
  const event = { ...base, adaptive_replanning_event_id: eventId };
  event.adaptive_replanning_event_hash = replanningEventHash(event);
  return deepFreeze(event);
}

export function projectWorldSimulationEffectiveAdaptiveReplanning(input = {}) {
  const worldState = cloneJson(object(input.world_state));
  const revised = projectWorldSimulationEffectiveRevisedGoalImplementationIntentions({ world_state: worldState });
  const replay = validateReplanningHistory(worldState);
  const projection = {
    version: effectiveAdaptiveReplanningProjectionVersion,
    source_phase69b_projection_version: revised.version,
    source_phase69b_projection_hash: revised.projection_hash,
    replanned_source_plan_ids: [...replay.replannedSources].sort(compareText),
    replanning_history_hash: hashAgentRunValue(replay.history),
    replayed_replanning_event_count: replay.history.length,
    replayable_projection: true,
    same_goal_preserved: true,
    phase69b_remains_plan_lifecycle_authority: true,
    numeric_scoring_modeled: false,
  };
  projection.projection_hash = hashAgentRunValue(projection);
  return deepFreeze(projection);
}

export function buildWorldSimulationAdaptiveReplanningContract() {
  return deepFreeze({
    version: worldSimulationAdaptiveReplanningVersion,
    phase: "Phase71",
    status: "execution_backed_adaptive_replanning_alternative_means_installed",
    supported_operation: "replan_same_goal",
    supported_candidate_kinds: [...supportedCandidateKinds],
    minimum_consecutive_failure_turns: minimumConsecutiveFailureTurns,
    same_goal_different_means: true,
    goal_commitment_preserved: true,
    phase69b_revision_owns_plan_supersession_and_replacement_identity: true,
    prior_committed_failure_evidence_only: true,
    prior_committed_subjective_block_belief_is_alternative_trigger: true,
    subjective_reconsideration_trigger_owner: "Phase73C",
    uncertain_subjective_assessment_auto_triggers: false,
    perceived_feasible_subjective_assessment_auto_triggers: false,
    same_turn_subjective_belief_feedback_allowed: false,
    single_action_failure_sufficient: false,
    single_plan_failure_event_sufficient: false,
    consecutive_distinct_turn_failures_required_for_failure_basis: true,
    candidate_generation_and_selection_separated: true,
    bounded_candidate_membership_required: true,
    bounded_character_means_grounding_catalog_required: true,
    candidate_character_cognition_grounding_required: true,
    replace_means_requires_grounding_beyond_failed_current_means: true,
    represented_same_goal_means_must_be_nonterminal: true,
    new_goal_creation_modeled: false,
    automatic_goal_abandonment_modeled: false,
    goal_unattainability_verification_modeled: false,
    goal_disengagement_reengagement_modeled: false,
    arbitrary_world_state_search_modeled: false,
    objective_feasibility_oracle_modeled: false,
    reinforcement_learning_modeled: false,
    expected_utility_optimizer_modeled: false,
    numeric_utility_priority_probability_feasibility_modeled: false,
    immutable_replanning_event_write_once_required: true,
    append_only_replanning_history_required: true,
    per_character_previous_event_hash_chain_required: true,
    authoritative_mutation_owner: "phase62k-authoritative-mutation-executor-v1",
    deterministic_replay_required: true,
    input_immutability_required: true,
  });
}

export function buildWorldSimulationAdaptiveReplanningEvents(input = {}) {
  const worldState = cloneJson(object(input.world_state));
  const turnId = boundedString(input.turn_id, "turn_id");
  const resolverView = input.resolver_view
    ? cloneJson(input.resolver_view)
    : buildWorldSimulationAdaptiveReplanningResolverView({
      world_state: worldState,
      turn_id: turnId,
      alternative_means_candidates: input.alternative_means_candidates,
    });
  const canonicalHash = hashAgentRunValue(
    Object.fromEntries(Object.entries(resolverView).filter(([key]) => key !== "resolver_view_hash")),
  );
  if (resolverView.version !== worldSimulationAdaptiveReplanningVersion
      || resolverView.turn_id !== turnId
      || canonicalHash !== resolverView.resolver_view_hash) {
    const error = new Error("Phase71 requires an exact canonical adaptive-replanning resolver view.");
    error.code = "WORLD_SIMULATION_ADAPTIVE_REPLANNING_RESOLVER_VIEW_INVALID";
    throw error;
  }
  const rawDecisions = array(input.replanning_decisions);
  const decisions = rawDecisions.map((decision) => normalizeDecision(decision, resolverView));
  const seenSourceRefs = new Set();
  for (const decision of decisions) {
    if (seenSourceRefs.has(decision.source.source_plan_ref)) {
      const error = new Error(`Phase71 allows at most one replan per source plan per turn: ${decision.source.source_plan_ref}.`);
      error.code = "WORLD_SIMULATION_ADAPTIVE_REPLANNING_PER_SOURCE_TURN_LIMIT";
      throw error;
    }
    seenSourceRefs.add(decision.source.source_plan_ref);
  }
  const currentExecution = projectWorldSimulationEffectiveGoalImplementationIntentionExecution({ world_state: worldState });
  const currentAdjustment = projectWorldSimulationEffectiveMotivationalGoalAdjustment({ world_state: worldState });
  const currentHistory = validateReplanningHistory(worldState);
  for (const decision of decisions) {
    const source = decision.source;
    const plan = findCharacterRecords(currentExecution.plans_by_character, source.character)[source.source_implementation_intention_id];
    const goal = findCharacterRecords(currentAdjustment.goals_by_character, source.character)[source.goal_id];
    const sourceKey = `${characterKey(source.character)}\u0000${source.source_implementation_intention_id}`;
    if (!plan
        || !["active", "challenged"].includes(plan.state)
        || plan.completed === true
        || plan.goal_id !== source.goal_id
        || !goal
        || goal.state !== "committed"
        || goal.achieved === true
        || goal.unattainable === true
        || goal.disengaged === true
        || currentHistory.replannedSources.has(sourceKey)) {
      const error = new Error(`Phase71 source plan ${source.source_implementation_intention_id} or goal ${source.goal_id} became ineligible before persistence.`);
      error.code = "WORLD_SIMULATION_ADAPTIVE_REPLANNING_SOURCE_INVALID";
      throw error;
    }
    if (source.eligibility_basis === "repeated_committed_failure") {
      const failures = trailingFailureEvidence(
        worldState,
        source.character,
        source.source_implementation_intention_id,
        source.goal_id,
        turnId,
      );
      const actualRefs = failures.map((event) => ({
        execution_feedback_event_id: event.execution_feedback_event_id,
        execution_feedback_event_hash: event.execution_feedback_event_hash,
        source_turn_id: event.source_turn_id,
        operation: event.operation,
      }));
      if (failures.length < minimumConsecutiveFailureTurns
          || !sameValue(actualRefs, source.failure_evidence_refs)
          || array(source.subjective_reconsideration_trigger_refs).length !== 0) {
        const error = new Error(`Phase71 source plan ${source.source_implementation_intention_id} no longer has the exact canonical repeated-failure evidence.`);
        error.code = "WORLD_SIMULATION_ADAPTIVE_REPLANNING_FAILURE_EVIDENCE_INVALID";
        throw error;
      }
    } else if (source.eligibility_basis === "committed_subjective_means_block") {
      const projection = projectWorldSimulationSubjectiveMeansReconsiderationTriggers({
        world_state: worldState,
        current_turn_id: turnId,
      });
      const trigger = array(projection.triggers).find((entry) =>
        sameCharacter(entry.character, source.character)
        && entry.goal_id === source.goal_id
        && entry.source_implementation_intention_id === source.source_implementation_intention_id);
      const expectedRefs = trigger
        ? [{
          trigger_ref: trigger.trigger_ref,
          trigger_hash: trigger.trigger_hash,
          trigger_kind: trigger.trigger_kind,
          assessment: trigger.assessment,
          active_blocked_linkage_refs: cloneJson(trigger.active_blocked_linkage_refs),
        }]
        : [];
      if (!trigger
          || source.failure_evidence_refs.length !== 0
          || source.consecutive_failure_count !== 0
          || !sameValue(expectedRefs, source.subjective_reconsideration_trigger_refs)) {
        const error = new Error(`Phase71 source plan ${source.source_implementation_intention_id} no longer has the exact canonical prior-committed subjective block belief trigger.`);
        error.code = "WORLD_SIMULATION_ADAPTIVE_REPLANNING_SUBJECTIVE_RECONSIDERATION_INVALID";
        throw error;
      }
    } else {
      const error = new Error(`Phase71 source plan ${source.source_implementation_intention_id} has an unsupported eligibility basis.`);
      error.code = "WORLD_SIMULATION_ADAPTIVE_REPLANNING_ELIGIBILITY_BASIS_INVALID";
      throw error;
    }
  }
  const revisionBuilt = buildWorldSimulationGoalImplementationIntentionRevisions({
    world_state: worldState,
    turn_id: turnId,
    revision_decisions: decisions.map(({ source, candidate }) => ({
      character: source.character,
      operation: "revise",
      target_implementation_intention_id: source.source_implementation_intention_id,
      replacement_cue_descriptor: cloneJson(candidate.replacement_cue_descriptor),
      replacement_response_descriptor: cloneJson(candidate.replacement_response_descriptor),
      reason: source.eligibility_basis === "committed_subjective_means_block"
        ? `phase71_${candidate.candidate_kind}_after_committed_subjective_means_block`
        : `phase71_${candidate.candidate_kind}_after_repeated_committed_failure`,
      source: "phase71_adaptive_replanning",
    })),
  });
  const revisionBySource = new Map(
    revisionBuilt.result.revision_events_created.map((event) => [
      `${characterKey(event.character)}\u0000${event.target_implementation_intention_id}`,
      event,
    ]),
  );
  const preview = cloneJson(revisionBuilt.result.preview_world_state);
  const latestByCharacter = new Map(currentHistory.latestByCharacter);
  const createdEvents = [];
  const appendedReferences = [];
  const stateTransitions = [];
  for (const decision of decisions) {
    const source = decision.source;
    const revisionEvent = revisionBySource.get(`${characterKey(source.character)}\u0000${source.source_implementation_intention_id}`);
    if (!revisionEvent || revisionEvent.goal_id !== source.goal_id) {
      const error = new Error(`Phase71 could not resolve its resulting Phase69B revision for ${source.source_implementation_intention_id}.`);
      error.code = "WORLD_SIMULATION_ADAPTIVE_REPLANNING_RESULTING_REVISION_INVALID";
      throw error;
    }
    const key = characterKey(source.character);
    const event = adaptiveEventFor(
      decision,
      revisionEvent,
      latestByCharacter.get(key) ?? null,
      turnId,
      resolverView.resolver_view_hash,
    );
    preview.goal_implementation_intention_adaptive_replanning_events = object(
      preview.goal_implementation_intention_adaptive_replanning_events,
    );
    if (preview.goal_implementation_intention_adaptive_replanning_events[event.adaptive_replanning_event_id]) {
      const error = new Error(`Phase71 event ${event.adaptive_replanning_event_id} already exists.`);
      error.code = "WORLD_SIMULATION_ADAPTIVE_REPLANNING_EVENT_IMMUTABILITY_VIOLATION";
      throw error;
    }
    preview.goal_implementation_intention_adaptive_replanning_events[event.adaptive_replanning_event_id] = cloneJson(event);
    const ref = historyReferenceFor(event);
    createdEvents.push(event);
    appendedReferences.push(ref);
    latestByCharacter.set(key, event);
    stateTransitions.push({
      entity: "world",
      field: `goal_implementation_intention_adaptive_replanning_events.${event.adaptive_replanning_event_id}`,
      from: null,
      to: cloneJson(event),
      cause: `persist immutable Phase71 AdaptiveReplanningEvent ${event.adaptive_replanning_event_id}`,
      source_layer: "adaptive_replanning_alternative_means",
    });
  }
  if (appendedReferences.length) {
    const nextHistory = [...currentHistory.history.map(cloneJson), ...appendedReferences.map(cloneJson)];
    preview.goal_implementation_intention_adaptive_replanning_history = nextHistory;
    stateTransitions.push({
      entity: "world",
      field: "goal_implementation_intention_adaptive_replanning_history",
      from: cloneJson(worldState.goal_implementation_intention_adaptive_replanning_history ?? null),
      to: cloneJson(nextHistory),
      cause: `append ${appendedReferences.length} Phase71 adaptive-replanning history reference(s)`,
      source_layer: "adaptive_replanning_alternative_means",
    });
  }
  const effectiveProjection = projectWorldSimulationEffectiveAdaptiveReplanning({ world_state: preview });
  return deepFreeze({
    ok: true,
    version: worldSimulationAdaptiveReplanningVersion,
    result: {
      replanning_decision_count: decisions.length,
      phase69b_revision_events_created: revisionBuilt.result.revision_events_created,
      phase69b_revision_state_transitions: revisionBuilt.result.state_transitions,
      phase69b_preview_world_state: revisionBuilt.result.preview_world_state,
      adaptive_replanning_events_created: createdEvents,
      history_references_appended: appendedReferences,
      state_transitions: stateTransitions,
      preview_world_state: preview,
      resolver_view_hash: resolverView.resolver_view_hash,
      authoritative_validation_context: authoritativeValidationContext(resolverView),
      effective_adaptive_replanning_projection: effectiveProjection,
      audit: {
        same_goal_preserved: true,
        phase69b_revision_owns_plan_lifecycle: true,
        prior_committed_failure_evidence_only: true,
        minimum_consecutive_failure_turns: minimumConsecutiveFailureTurns,
        single_action_failure_sufficient: false,
        single_plan_failure_event_sufficient: false,
        bounded_candidate_membership_required: true,
        bounded_character_means_grounding_catalog_required: true,
        candidate_character_cognition_grounding_required: true,
        replace_means_requires_grounding_beyond_failed_current_means: true,
        goal_state_mutated: false,
        goal_unattainability_asserted: false,
        goal_disengagement_asserted: false,
        arbitrary_world_state_search_used: false,
        numeric_scoring_modeled: false,
      },
    },
  });
}
