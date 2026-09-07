import { hashAgentRunValue } from "./agent-run-service.mjs";
import { projectWorldSimulationEffectiveRevisedGoalImplementationIntentions } from "./world-simulation-goal-implementation-intention-revision-service.mjs";

export const worldSimulationGoalImplementationIntentionExecutionFeedbackVersion = "phase69d-goal-implementation-intention-execution-feedback-v1";
export const goalImplementationIntentionExecutionFeedbackEventSchemaVersion = "phase69d-goal-implementation-intention-execution-feedback-event-v1";
export const goalImplementationIntentionExecutionFeedbackHistoryReferenceSchemaVersion = "phase69d-goal-implementation-intention-execution-feedback-history-ref-v1";
export const effectiveGoalImplementationIntentionExecutionProjectionVersion = "phase69d-effective-goal-implementation-intention-execution-projection-v1";

const supportedOperations = Object.freeze(["attempted", "fulfilled", "failed", "completed"]);

function isObject(value) { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function object(value) { return isObject(value) ? value : {}; }
function array(value) { return Array.isArray(value) ? value : []; }
function cloneJson(value) { return JSON.parse(JSON.stringify(value ?? null)); }
function optionalString(value) { return typeof value === "string" && value.trim() ? value.trim() : null; }
function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}
function boundedString(value, label, maxLength = 240, code = "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_EXECUTION_FEEDBACK_INPUT_INVALID") {
  const text = optionalString(value);
  if (!text || text.length > maxLength) {
    const error = new Error(`${label} must be a non-empty string no longer than ${maxLength} characters.`);
    error.code = code;
    throw error;
  }
  return text;
}
function characterKey(value) { return boundedString(value, "character").toLocaleLowerCase("zh-Hant-TW"); }
function sameCharacter(left, right) {
  const leftText = optionalString(left);
  const rightText = optionalString(right);
  return Boolean(leftText && rightText)
    && leftText.toLocaleLowerCase("zh-Hant-TW") === rightText.toLocaleLowerCase("zh-Hant-TW");
}
function hashWithout(value, field) { const body = cloneJson(value); delete body[field]; return hashAgentRunValue(body); }
function feedbackEventHash(event) { return hashWithout(event, "execution_feedback_event_hash"); }
function findCharacterPlans(recordsByCharacter, character) {
  for (const [name, records] of Object.entries(recordsByCharacter ?? {})) {
    if (sameCharacter(name, character)) return object(records);
  }
  return {};
}
function sanitizeEvidence(value, depth = 0) {
  if (depth > 8) return null;
  if (Array.isArray(value)) return value.slice(0, 64).map((item) => sanitizeEvidence(item, depth + 1));
  if (!isObject(value)) {
    if (typeof value === "string") return value.slice(0, 1200);
    if (typeof value === "number" || typeof value === "boolean" || value == null) return value;
    return null;
  }
  const clean = {};
  for (const [key, child] of Object.entries(value).slice(0, 96)) {
    if (["world_state", "mutation", "mutation_path", "world_state_patch", "hidden_retrieval_graph", "memory_store"].includes(String(key).toLowerCase())) continue;
    clean[key] = sanitizeEvidence(child, depth + 1);
  }
  return clean;
}

function validatePersistedFeedbackEvent(event, eventId) {
  if (!isObject(event)
      || event.schema_version !== goalImplementationIntentionExecutionFeedbackEventSchemaVersion
      || event.version !== worldSimulationGoalImplementationIntentionExecutionFeedbackVersion
      || event.immutable !== true
      || event.execution_feedback_event_id !== eventId
      || !optionalString(event.execution_feedback_event_hash)
      || !optionalString(event.character)
      || !optionalString(event.source_turn_id)
      || !supportedOperations.includes(event.operation)
      || !optionalString(event.implementation_intention_id)
      || !optionalString(event.goal_id)
      || !optionalString(event.plan_projection_hash)
      || !optionalString(event.selected_action_evidence_hash)
      || !optionalString(event.causal_outcome_evidence_hash)
      || !optionalString(event.resolver_view_hash)
      || event.authoritative_action_outcome_evidence !== true
      || event.plan_completion_is_explicit !== true
      || event.action_success_implies_plan_completion !== false
      || event.plan_completion_implies_goal_achievement !== false
      || event.goal_achievement_authority !== false
      || event.action_selection_authority !== false
      || event.utility_score !== null
      || event.priority_score !== null
      || event.success_probability !== null
      || event.confidence !== null
      || event.character_brain_direct_write !== false
      || event.status !== "goal_implementation_intention_execution_feedback_recorded") {
    const error = new Error(`GoalImplementationIntentionExecutionFeedbackEvent ${eventId} is invalid.`);
    error.code = "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_EXECUTION_FEEDBACK_EVENT_INVALID";
    throw error;
  }
  if (feedbackEventHash(event) !== event.execution_feedback_event_hash) {
    const error = new Error(`GoalImplementationIntentionExecutionFeedbackEvent ${eventId} failed hash verification.`);
    error.code = "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_EXECUTION_FEEDBACK_EVENT_HASH_MISMATCH";
    throw error;
  }
  return event;
}

function validateFeedbackHistory(worldState) {
  if (Object.hasOwn(worldState, "goal_implementation_intention_execution_feedback_events")
      && !isObject(worldState.goal_implementation_intention_execution_feedback_events)) {
    const error = new Error("goal_implementation_intention_execution_feedback_events must be an object.");
    error.code = "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_EXECUTION_FEEDBACK_EVENT_STORE_INVALID";
    throw error;
  }
  if (Object.hasOwn(worldState, "goal_implementation_intention_execution_feedback_history")
      && !Array.isArray(worldState.goal_implementation_intention_execution_feedback_history)) {
    const error = new Error("goal_implementation_intention_execution_feedback_history must be an array.");
    error.code = "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_EXECUTION_FEEDBACK_HISTORY_INVALID";
    throw error;
  }
  const events = object(worldState.goal_implementation_intention_execution_feedback_events);
  const history = array(worldState.goal_implementation_intention_execution_feedback_history);
  const latestByCharacter = new Map();
  const seenEventIds = new Set();
  const completedPlans = new Set();
  for (const [index, ref] of history.entries()) {
    if (!isObject(ref)
        || ref.schema_version !== goalImplementationIntentionExecutionFeedbackHistoryReferenceSchemaVersion
        || ref.derived_index !== true
        || !optionalString(ref.execution_feedback_event_id)
        || !optionalString(ref.execution_feedback_event_hash)
        || !optionalString(ref.character)
        || !optionalString(ref.source_turn_id)
        || !supportedOperations.includes(ref.operation)
        || !optionalString(ref.implementation_intention_id)
        || !optionalString(ref.goal_id)
        || ref.status !== "goal_implementation_intention_execution_feedback_recorded") {
      const error = new Error(`goal_implementation_intention_execution_feedback_history[${index}] is invalid.`);
      error.code = "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_EXECUTION_FEEDBACK_HISTORY_REFERENCE_INVALID";
      throw error;
    }
    if (seenEventIds.has(ref.execution_feedback_event_id)) {
      const error = new Error(`Duplicate Phase69D execution-feedback event ${ref.execution_feedback_event_id}.`);
      error.code = "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_EXECUTION_FEEDBACK_IDENTITY_REUSE_FORBIDDEN";
      throw error;
    }
    const event = validatePersistedFeedbackEvent(events[ref.execution_feedback_event_id], ref.execution_feedback_event_id);
    const key = characterKey(event.character);
    const previous = latestByCharacter.get(key) ?? null;
    if (ref.execution_feedback_event_hash !== event.execution_feedback_event_hash
        || ref.character !== event.character
        || ref.source_turn_id !== event.source_turn_id
        || ref.operation !== event.operation
        || ref.implementation_intention_id !== event.implementation_intention_id
        || ref.goal_id !== event.goal_id
        || ref.previous_execution_feedback_event_id !== event.previous_execution_feedback_event_id
        || ref.previous_execution_feedback_event_hash !== event.previous_execution_feedback_event_hash
        || event.previous_execution_feedback_event_id !== (previous?.execution_feedback_event_id ?? null)
        || event.previous_execution_feedback_event_hash !== (previous?.execution_feedback_event_hash ?? null)) {
      const error = new Error(`Phase69D history reference ${ref.execution_feedback_event_id} breaks its per-character chain.`);
      error.code = "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_EXECUTION_FEEDBACK_HISTORY_REFERENCE_MISMATCH";
      throw error;
    }
    const planKey = `${key}\u0000${event.implementation_intention_id}`;
    if (completedPlans.has(planKey)) {
      const error = new Error(`Phase69D plan ${event.implementation_intention_id} received feedback after completion.`);
      error.code = "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_EXECUTION_FEEDBACK_AFTER_COMPLETION_FORBIDDEN";
      throw error;
    }
    if (event.operation === "completed") completedPlans.add(planKey);
    seenEventIds.add(event.execution_feedback_event_id);
    latestByCharacter.set(key, event);
  }
  return { events, history, latestByCharacter, completedPlans };
}

export function projectWorldSimulationEffectiveGoalImplementationIntentionExecution(input = {}) {
  const worldState = cloneJson(object(input.world_state));
  const revised = projectWorldSimulationEffectiveRevisedGoalImplementationIntentions({ world_state: worldState });
  const feedback = validateFeedbackHistory(worldState);
  const plansByCharacter = cloneJson(revised.plans_by_character);
  for (const records of Object.values(plansByCharacter)) {
    for (const plan of Object.values(object(records))) {
      plan.execution_state = "untouched";
      plan.completed = false;
      plan.latest_execution_feedback_event_id = null;
      plan.execution_feedback_event_count = 0;
    }
  }
  feedback.history.forEach((ref) => {
    const event = feedback.events[ref.execution_feedback_event_id];
    const records = findCharacterPlans(plansByCharacter, event.character);
    const plan = records[event.implementation_intention_id];
    if (!plan) {
      const error = new Error(`Phase69D target plan ${event.implementation_intention_id} does not exist during replay.`);
      error.code = "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_EXECUTION_FEEDBACK_TARGET_INVALID";
      throw error;
    }
    if (plan.completed) {
      const error = new Error(`Phase69D target plan ${event.implementation_intention_id} is already completed.`);
      error.code = "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_EXECUTION_FEEDBACK_AFTER_COMPLETION_FORBIDDEN";
      throw error;
    }
    plan.execution_state = event.operation;
    plan.completed = event.operation === "completed";
    plan.latest_execution_feedback_event_id = event.execution_feedback_event_id;
    plan.execution_feedback_event_count += 1;
  });
  const projection = {
    version: effectiveGoalImplementationIntentionExecutionProjectionVersion,
    source_revision_projection_version: revised.version,
    plans_by_character: plansByCharacter,
    feedback_history_hash: hashAgentRunValue(feedback.history),
    replayed_feedback_event_count: feedback.history.length,
    replayable_projection: true,
    completion_is_explicit: true,
    completion_is_irreversible_v1: true,
    completed_plan_history_preserved: true,
    action_success_implies_plan_completion: false,
    plan_completion_implies_goal_achievement: false,
    goal_achievement_authority_claimed: false,
    numeric_success_score_modeled: false,
  };
  projection.projection_hash = hashAgentRunValue(projection);
  return deepFreeze(projection);
}

export function buildWorldSimulationGoalImplementationIntentionExecutionFeedbackResolverView(input = {}) {
  const worldState = cloneJson(object(input.world_state));
  const turnId = boundedString(input.turn_id, "turn_id");
  const selectedActions = array(input.selected_action_intents);
  const actionOutcomes = array(input.action_outcomes);
  const activationByCharacter = object(input.activation_by_character);
  const effective = projectWorldSimulationEffectiveGoalImplementationIntentionExecution({ world_state: worldState });
  const plans = [];
  for (const [character, records] of Object.entries(effective.plans_by_character ?? {})) {
    const selectedAction = selectedActions.find((item) => sameCharacter(item?.character ?? item?.actor, character)) ?? null;
    const actionOutcome = actionOutcomes.find((item) => sameCharacter(item?.actor ?? item?.character, character)) ?? null;
    if (!selectedAction || !actionOutcome) continue;
    for (const plan of Object.values(object(records))) {
      if (plan.completed === true || !["active", "challenged"].includes(plan.state)) continue;
      const descriptor = {
        character,
        implementation_intention_id: plan.implementation_intention_id,
        goal_id: plan.goal_id,
        cue_descriptor: cloneJson(plan.cue_descriptor),
        response_descriptor: cloneJson(plan.response_descriptor),
        reconsideration_state: plan.state,
        execution_state: plan.execution_state,
      };
      plans.push({
        plan_ref: `phase69d_plan_${hashAgentRunValue({ version: worldSimulationGoalImplementationIntentionExecutionFeedbackVersion, turn_id: turnId, descriptor }).slice(0, 24)}`,
        ...descriptor,
        selected_action: sanitizeEvidence(selectedAction),
        selected_action_evidence_hash: hashAgentRunValue(selectedAction),
        authoritative_causal_outcome: sanitizeEvidence(actionOutcome),
        causal_outcome_evidence_hash: hashAgentRunValue(actionOutcome),
        phase69c_activated: array(activationByCharacter[character]).some((item) => item?.implementation_intention_id === plan.implementation_intention_id || item?.plan_ref === plan.implementation_intention_id),
      });
    }
  }
  const view = {
    version: worldSimulationGoalImplementationIntentionExecutionFeedbackVersion,
    turn_id: turnId,
    plans,
    supported_operations: [...supportedOperations],
    resolver_may_return_only_plan_ref_operation_pairs: true,
    authoritative_action_outcome_evidence_only: true,
    explicit_completion_required: true,
    action_success_implies_plan_completion: false,
    plan_completion_implies_goal_achievement: false,
    goal_achievement_requested: false,
    action_selection_requested: false,
    raw_world_state_exposed: false,
    raw_memory_store_exposed: false,
    hidden_retrieval_graph_exposed: false,
    numeric_scoring_requested: false,
  };
  view.resolver_view_hash = hashAgentRunValue(view);
  return deepFreeze(view);
}

function normalizeDecision(raw, resolverView, effective) {
  if (!isObject(raw)) {
    const error = new Error("Phase69D execution-feedback decision must be an object.");
    error.code = "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_EXECUTION_FEEDBACK_DECISION_INVALID";
    throw error;
  }
  const planRef = boundedString(raw.plan_ref, "plan_ref", 180,
    "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_EXECUTION_FEEDBACK_TARGET_INVALID");
  const operation = boundedString(raw.operation, "operation", 80,
    "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_EXECUTION_FEEDBACK_DECISION_INVALID");
  if (!supportedOperations.includes(operation)) {
    const error = new Error(`Unsupported Phase69D operation ${operation}.`);
    error.code = "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_EXECUTION_FEEDBACK_OPERATION_UNSUPPORTED";
    throw error;
  }
  const plan = resolverView.plans.find((item) => item.plan_ref === planRef);
  if (!plan) {
    const error = new Error(`Unknown Phase69D plan ref ${planRef}.`);
    error.code = "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_EXECUTION_FEEDBACK_TARGET_INVALID";
    throw error;
  }
  const records = findCharacterPlans(effective.plans_by_character, plan.character);
  const effectivePlan = records[plan.implementation_intention_id];
  if (!effectivePlan || effectivePlan.completed === true) {
    const error = new Error(`Phase69D target plan ${plan.implementation_intention_id} is unavailable or completed.`);
    error.code = "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_EXECUTION_FEEDBACK_TARGET_INVALID";
    throw error;
  }
  return {
    character: plan.character,
    operation,
    implementation_intention_id: plan.implementation_intention_id,
    goal_id: plan.goal_id,
    plan_projection_hash: effective.projection_hash,
    selected_action_evidence_hash: plan.selected_action_evidence_hash,
    causal_outcome_evidence_hash: plan.causal_outcome_evidence_hash,
    resolver_view_hash: resolverView.resolver_view_hash,
    reason: optionalString(raw.reason) ?? `explicit_programmatic_plan_execution_${operation}`,
    source: optionalString(raw.source) ?? "programmatic_implementation_intention_execution_feedback_resolver",
  };
}

function eventFor(decision, previous, turnId) {
  const base = {
    schema_version: goalImplementationIntentionExecutionFeedbackEventSchemaVersion,
    version: worldSimulationGoalImplementationIntentionExecutionFeedbackVersion,
    immutable: true,
    character: decision.character,
    source_turn_id: turnId,
    operation: decision.operation,
    implementation_intention_id: decision.implementation_intention_id,
    goal_id: decision.goal_id,
    plan_projection_hash: decision.plan_projection_hash,
    selected_action_evidence_hash: decision.selected_action_evidence_hash,
    causal_outcome_evidence_hash: decision.causal_outcome_evidence_hash,
    resolver_view_hash: decision.resolver_view_hash,
    previous_execution_feedback_event_id: previous?.execution_feedback_event_id ?? null,
    previous_execution_feedback_event_hash: previous?.execution_feedback_event_hash ?? null,
    execution_feedback_evidence: {
      decision_source: decision.source,
      decision_reason: decision.reason,
      authoritative_action_outcome_evidence: true,
      explicit_completion_required: true,
      action_success_implies_plan_completion: false,
      plan_completion_implies_goal_achievement: false,
    },
    authoritative_action_outcome_evidence: true,
    plan_completion_is_explicit: true,
    action_success_implies_plan_completion: false,
    plan_completion_implies_goal_achievement: false,
    goal_achievement_authority: false,
    action_selection_authority: false,
    utility_score: null,
    priority_score: null,
    success_probability: null,
    confidence: null,
    character_brain_direct_write: false,
    status: "goal_implementation_intention_execution_feedback_recorded",
  };
  const eventId = `goal_implementation_intention_execution_feedback_event_${hashAgentRunValue({
    version: worldSimulationGoalImplementationIntentionExecutionFeedbackVersion,
    character: characterKey(decision.character),
    source_turn_id: turnId,
    operation: decision.operation,
    implementation_intention_id: decision.implementation_intention_id,
    selected_action_evidence_hash: decision.selected_action_evidence_hash,
    causal_outcome_evidence_hash: decision.causal_outcome_evidence_hash,
    previous_execution_feedback_event_hash: previous?.execution_feedback_event_hash ?? null,
  }).slice(0, 24)}`;
  const event = { ...base, execution_feedback_event_id: eventId };
  event.execution_feedback_event_hash = feedbackEventHash(event);
  return deepFreeze(event);
}
function historyRefFor(event) {
  return deepFreeze({
    schema_version: goalImplementationIntentionExecutionFeedbackHistoryReferenceSchemaVersion,
    derived_index: true,
    execution_feedback_event_id: event.execution_feedback_event_id,
    execution_feedback_event_hash: event.execution_feedback_event_hash,
    character: event.character,
    source_turn_id: event.source_turn_id,
    operation: event.operation,
    implementation_intention_id: event.implementation_intention_id,
    goal_id: event.goal_id,
    previous_execution_feedback_event_id: event.previous_execution_feedback_event_id,
    previous_execution_feedback_event_hash: event.previous_execution_feedback_event_hash,
    status: event.status,
  });
}

export function buildWorldSimulationGoalImplementationIntentionExecutionFeedbackContract() {
  return deepFreeze({
    version: worldSimulationGoalImplementationIntentionExecutionFeedbackVersion,
    phase: "Phase69D",
    status: "plan_execution_feedback_completion_monitoring_installed",
    supported_operations: [...supportedOperations],
    authoritative_action_outcome_evidence_only: true,
    immutable_feedback_event_write_once_required: true,
    append_only_feedback_history_required: true,
    per_character_previous_event_hash_chain_required: true,
    explicit_completion_deactivation_required: true,
    completed_plan_history_preserved: true,
    action_success_implies_plan_fulfillment: false,
    action_success_implies_plan_completion: false,
    plan_completion_implies_goal_achievement: false,
    goal_achievement_authority_claimed: false,
    autonomous_replanning_modeled: false,
    action_selection_authority_claimed: false,
    numeric_success_utility_priority_probability_confidence_modeled: false,
    character_brain_direct_durable_write_allowed: false,
    authoritative_mutation_owner: "phase62k-authoritative-mutation-executor-v1",
    deterministic_replay_required: true,
    input_immutability_required: true,
  });
}

export function buildWorldSimulationGoalImplementationIntentionExecutionFeedback(input = {}) {
  const worldState = cloneJson(object(input.world_state));
  const turnId = boundedString(input.turn_id, "turn_id");
  const rawDecisions = array(input.feedback_decisions);
  const resolverView = input.resolver_view
    ? cloneJson(input.resolver_view)
    : buildWorldSimulationGoalImplementationIntentionExecutionFeedbackResolverView({
      world_state: worldState,
      turn_id: turnId,
      selected_action_intents: input.selected_action_intents,
      action_outcomes: input.action_outcomes,
      activation_by_character: input.activation_by_character,
    });
  const canonicalHash = hashAgentRunValue(Object.fromEntries(Object.entries(resolverView).filter(([key]) => key !== "resolver_view_hash")));
  if (resolverView.version !== worldSimulationGoalImplementationIntentionExecutionFeedbackVersion
      || resolverView.turn_id !== turnId
      || canonicalHash !== resolverView.resolver_view_hash) {
    const error = new Error("Phase69D requires an exact canonical execution-feedback resolver view.");
    error.code = "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_EXECUTION_FEEDBACK_RESOLVER_VIEW_INVALID";
    throw error;
  }
  const inputSnapshot = cloneJson({ world_state: worldState, turn_id: turnId, feedback_decisions: rawDecisions, resolver_view: resolverView });
  const inputHash = hashAgentRunValue(inputSnapshot);
  const existing = validateFeedbackHistory(worldState);
  const effective = projectWorldSimulationEffectiveGoalImplementationIntentionExecution({ world_state: worldState });
  const decisions = rawDecisions.map((decision) => normalizeDecision(decision, resolverView, effective));
  const existingTurnPlanKeys = new Set(existing.history
    .map((ref) => existing.events[ref.execution_feedback_event_id])
    .filter((event) => event?.source_turn_id === turnId)
    .map((event) => `${characterKey(event.character)}\u0000${event.implementation_intention_id}`));
  const seenTurnPlanKeys = new Set();
  for (const decision of decisions) {
    const key = `${characterKey(decision.character)}\u0000${decision.implementation_intention_id}`;
    if (existingTurnPlanKeys.has(key) || seenTurnPlanKeys.has(key)) {
      const error = new Error("Phase69D allows at most one durable feedback event per character/plan per turn.");
      error.code = "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_EXECUTION_FEEDBACK_PER_PLAN_TURN_LIMIT";
      throw error;
    }
    seenTurnPlanKeys.add(key);
  }
  const preview = cloneJson(worldState);
  const latestByCharacter = new Map(existing.latestByCharacter);
  const createdEvents = [];
  const appendedReferences = [];
  const stateTransitions = [];
  for (const decision of decisions) {
    const event = eventFor(decision, latestByCharacter.get(characterKey(decision.character)) ?? null, turnId);
    preview.goal_implementation_intention_execution_feedback_events = object(preview.goal_implementation_intention_execution_feedback_events);
    if (preview.goal_implementation_intention_execution_feedback_events[event.execution_feedback_event_id]) {
      const error = new Error(`Phase69D execution-feedback event ${event.execution_feedback_event_id} already exists.`);
      error.code = "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_EXECUTION_FEEDBACK_EVENT_IMMUTABILITY_VIOLATION";
      throw error;
    }
    preview.goal_implementation_intention_execution_feedback_events[event.execution_feedback_event_id] = cloneJson(event);
    const ref = historyRefFor(event);
    createdEvents.push(event);
    appendedReferences.push(ref);
    latestByCharacter.set(characterKey(event.character), event);
    stateTransitions.push({ entity: "world", field: `goal_implementation_intention_execution_feedback_events.${event.execution_feedback_event_id}`, from: null, to: cloneJson(event), cause: `persist immutable GoalImplementationIntentionExecutionFeedbackEvent ${event.execution_feedback_event_id}`, source_layer: "goal_implementation_intention_execution_feedback" });
  }
  if (appendedReferences.length) {
    const nextHistory = [...existing.history.map(cloneJson), ...appendedReferences.map(cloneJson)];
    preview.goal_implementation_intention_execution_feedback_history = nextHistory;
    stateTransitions.push({ entity: "world", field: "goal_implementation_intention_execution_feedback_history", from: cloneJson(worldState.goal_implementation_intention_execution_feedback_history ?? null), to: cloneJson(nextHistory), cause: `append ${appendedReferences.length} Phase69D execution-feedback history reference(s)`, source_layer: "goal_implementation_intention_execution_feedback" });
  }
  const effectiveProjection = projectWorldSimulationEffectiveGoalImplementationIntentionExecution({ world_state: preview });
  if (hashAgentRunValue(inputSnapshot) !== inputHash) {
    const error = new Error("Phase69D execution feedback mutated its input snapshot.");
    error.code = "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_EXECUTION_FEEDBACK_INPUT_MUTATED";
    throw error;
  }
  return deepFreeze({
    ok: true,
    version: worldSimulationGoalImplementationIntentionExecutionFeedbackVersion,
    result: {
      feedback_decision_count: decisions.length,
      execution_feedback_events_created: createdEvents,
      history_references_appended: appendedReferences,
      state_transitions: stateTransitions,
      preview_world_state: preview,
      resolver_view_hash: resolverView.resolver_view_hash,
      effective_execution_projection: effectiveProjection,
      audit: {
        input_context_hash: inputHash,
        authoritative_action_outcome_evidence_only: true,
        explicit_completion_required: true,
        completed_plan_history_preserved: true,
        action_success_implies_plan_completion: false,
        plan_completion_implies_goal_achievement: false,
        goal_achievement_authority_claimed: false,
        action_selection_authority_claimed: false,
        numeric_scoring_modeled: false,
      },
    },
  });
}
