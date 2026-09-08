import { hashAgentRunValue } from "./agent-run-service.mjs";
import { projectWorldSimulationEffectiveMotivationalGoals } from "./world-simulation-motivation-goal-integration-service.mjs";

export const worldSimulationGoalAchievementVerificationVersion = "phase70a-goal-achievement-verification-v1";
export const motivationalGoalAchievementEventSchemaVersion = "phase70a-motivational-goal-achievement-event-v1";
export const motivationalGoalAchievementHistoryReferenceSchemaVersion = "phase70a-motivational-goal-achievement-history-ref-v1";
export const effectiveMotivationalGoalLifecycleProjectionVersion = "phase70a-effective-motivational-goal-lifecycle-projection-v1";
export const motivationalGoalLifecycleCharacterProjectionVersion = "phase70a-bounded-motivational-goal-lifecycle-character-projection-v1";
export const motivationalGoalLifecycleMaxCharacterItems = 8;

const supportedOperations = Object.freeze(["achieve"]);
const eligibleGoalKinds = Object.freeze(["achieve_state", "restore_state"]);
const eligibleGoalStates = Object.freeze(["committed", "suspended"]);
const evidenceKinds = Object.freeze(["causal_state_transition", "action_outcome", "knowledge_transition"]);

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
function boundedString(value, label, maxLength = 240, code = "WORLD_SIMULATION_GOAL_ACHIEVEMENT_INPUT_INVALID") {
  const text = optionalString(value);
  if (!text || text.length > maxLength) {
    const error = new Error(`${label} must be a non-empty string no longer than ${maxLength} characters.`);
    error.code = code;
    throw error;
  }
  return text;
}
function characterKey(value) { return boundedString(value, "character").toLocaleLowerCase("zh-Hant-TW"); }
function sameCharacter(left, right) { return characterKey(left) === characterKey(right); }
function compareText(left, right) { return String(left ?? "").localeCompare(String(right ?? ""), "en"); }
function hashWithout(value, field) { const body = cloneJson(value); delete body[field]; return hashAgentRunValue(body); }
function achievementEventHash(event) { return hashWithout(event, "goal_achievement_event_hash"); }

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
    if (["world_state", "next_world_state", "preview_world_state", "memory_store", "hidden_retrieval_graph"].includes(String(key).toLowerCase())) continue;
    clean[key] = sanitizeEvidence(child, depth + 1);
  }
  return clean;
}

function findCharacterGoals(projection, character) {
  for (const [name, records] of Object.entries(projection.goals_by_character ?? {})) {
    if (sameCharacter(name, character)) return object(records);
  }
  return {};
}

function latestGoalEvent(worldState, character, goalId) {
  const history = array(worldState.motivational_goal_history);
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const ref = history[index];
    if (ref?.goal_id !== goalId || !sameCharacter(ref?.character, character)) continue;
    const event = object(object(worldState.motivational_goal_events)[ref.goal_event_id]);
    if (!optionalString(event.goal_event_hash)) return null;
    return event;
  }
  return null;
}

function goalAlreadyUnattainable(worldState, character, goalId) {
  return array(worldState.motivational_goal_unattainability_history).some((ref) => (
    ref?.operation === "verify_unattainable"
    && ref?.status === "motivational_goal_unattainability_recorded"
    && ref?.goal_id === goalId
    && sameCharacter(ref?.character, character)
  ));
}

function validatePersistedAchievementEvent(event, eventId) {
  if (!isObject(event)
      || event.schema_version !== motivationalGoalAchievementEventSchemaVersion
      || event.version !== worldSimulationGoalAchievementVerificationVersion
      || event.immutable !== true
      || event.goal_achievement_event_id !== eventId
      || !optionalString(event.goal_achievement_event_hash)
      || !optionalString(event.character)
      || !optionalString(event.source_turn_id)
      || event.operation !== "achieve"
      || !optionalString(event.goal_id)
      || !eligibleGoalKinds.includes(event.goal_kind)
      || !optionalString(event.source_goal_event_id)
      || !optionalString(event.source_goal_event_hash)
      || !optionalString(event.goal_projection_hash)
      || !Array.isArray(event.achievement_evidence_refs)
      || event.achievement_evidence_refs.length < 1
      || !optionalString(event.resolver_view_hash)
      || event.explicit_goal_condition_verification !== true
      || event.action_success_implies_goal_achievement !== false
      || event.plan_fulfillment_implies_goal_achievement !== false
      || event.plan_completion_implies_goal_achievement !== false
      || event.failure_or_unattainability_modeled !== false
      || event.world_state_scanned !== false
      || event.numeric_scoring_modeled !== false
      || event.character_brain_direct_write !== false
      || event.status !== "motivational_goal_achievement_recorded") {
    const error = new Error(`MotivationalGoalAchievementEvent ${eventId} is invalid.`);
    error.code = "WORLD_SIMULATION_GOAL_ACHIEVEMENT_EVENT_INVALID";
    throw error;
  }
  const keys = new Set();
  for (const ref of event.achievement_evidence_refs) {
    if (!isObject(ref)
        || !evidenceKinds.includes(ref.evidence_kind)
        || !optionalString(ref.evidence_ref)
        || !optionalString(ref.evidence_hash)
        || keys.has(ref.evidence_ref)) {
      const error = new Error(`MotivationalGoalAchievementEvent ${eventId} has invalid evidence refs.`);
      error.code = "WORLD_SIMULATION_GOAL_ACHIEVEMENT_EVIDENCE_REF_INVALID";
      throw error;
    }
    keys.add(ref.evidence_ref);
  }
  if (achievementEventHash(event) !== event.goal_achievement_event_hash) {
    const error = new Error(`MotivationalGoalAchievementEvent ${eventId} failed hash verification.`);
    error.code = "WORLD_SIMULATION_GOAL_ACHIEVEMENT_EVENT_HASH_MISMATCH";
    throw error;
  }
  return event;
}

function validateAchievementHistory(worldState) {
  if (Object.hasOwn(worldState, "motivational_goal_achievement_events")
      && !isObject(worldState.motivational_goal_achievement_events)) {
    const error = new Error("motivational_goal_achievement_events must be an object.");
    error.code = "WORLD_SIMULATION_GOAL_ACHIEVEMENT_EVENT_STORE_INVALID";
    throw error;
  }
  if (Object.hasOwn(worldState, "motivational_goal_achievement_history")
      && !Array.isArray(worldState.motivational_goal_achievement_history)) {
    const error = new Error("motivational_goal_achievement_history must be an array.");
    error.code = "WORLD_SIMULATION_GOAL_ACHIEVEMENT_HISTORY_INVALID";
    throw error;
  }
  const events = object(worldState.motivational_goal_achievement_events);
  const history = array(worldState.motivational_goal_achievement_history);
  const latestByCharacter = new Map();
  const achievedGoals = new Set();
  const seenEventIds = new Set();
  for (const [index, ref] of history.entries()) {
    if (!isObject(ref)
        || ref.schema_version !== motivationalGoalAchievementHistoryReferenceSchemaVersion
        || ref.derived_index !== true
        || !optionalString(ref.goal_achievement_event_id)
        || !optionalString(ref.goal_achievement_event_hash)
        || !optionalString(ref.goal_id)
        || !optionalString(ref.character)
        || !optionalString(ref.source_turn_id)
        || ref.operation !== "achieve"
        || ref.status !== "motivational_goal_achievement_recorded") {
      const error = new Error(`motivational_goal_achievement_history[${index}] is invalid.`);
      error.code = "WORLD_SIMULATION_GOAL_ACHIEVEMENT_HISTORY_REFERENCE_INVALID";
      throw error;
    }
    if (seenEventIds.has(ref.goal_achievement_event_id)) {
      const error = new Error(`Duplicate Phase70A achievement event ${ref.goal_achievement_event_id}.`);
      error.code = "WORLD_SIMULATION_GOAL_ACHIEVEMENT_IDENTITY_REUSE_FORBIDDEN";
      throw error;
    }
    const event = validatePersistedAchievementEvent(events[ref.goal_achievement_event_id], ref.goal_achievement_event_id);
    const key = characterKey(event.character);
    const goalKey = `${key}\u0000${event.goal_id}`;
    const previous = latestByCharacter.get(key) ?? null;
    if (achievedGoals.has(goalKey)) {
      const error = new Error(`Phase70A goal ${event.goal_id} was achieved more than once.`);
      error.code = "WORLD_SIMULATION_GOAL_ACHIEVEMENT_DUPLICATE_FORBIDDEN";
      throw error;
    }
    if (ref.goal_achievement_event_hash !== event.goal_achievement_event_hash
        || ref.goal_id !== event.goal_id
        || ref.character !== event.character
        || ref.source_turn_id !== event.source_turn_id
        || ref.previous_goal_achievement_event_id !== event.previous_goal_achievement_event_id
        || ref.previous_goal_achievement_event_hash !== event.previous_goal_achievement_event_hash
        || event.previous_goal_achievement_event_id !== (previous?.goal_achievement_event_id ?? null)
        || event.previous_goal_achievement_event_hash !== (previous?.goal_achievement_event_hash ?? null)) {
      const error = new Error(`Phase70A history reference ${ref.goal_achievement_event_id} breaks its per-character chain.`);
      error.code = "WORLD_SIMULATION_GOAL_ACHIEVEMENT_HISTORY_REFERENCE_MISMATCH";
      throw error;
    }
    seenEventIds.add(event.goal_achievement_event_id);
    achievedGoals.add(goalKey);
    latestByCharacter.set(key, event);
  }
  return { events, history, latestByCharacter, achievedGoals, seenEventIds };
}

export function projectWorldSimulationEffectiveMotivationalGoalLifecycle(input = {}) {
  const worldState = cloneJson(object(input.world_state));
  const phase68d = projectWorldSimulationEffectiveMotivationalGoals({ world_state: worldState });
  const achievements = validateAchievementHistory(worldState);
  const goalsByCharacter = cloneJson(phase68d.goals_by_character);
  for (const records of Object.values(goalsByCharacter)) {
    for (const record of Object.values(object(records))) {
      record.achieved = false;
      record.latest_achievement_event_id = null;
    }
  }
  achievements.history.forEach((ref) => {
    const event = achievements.events[ref.goal_achievement_event_id];
    const records = findCharacterGoals({ goals_by_character: goalsByCharacter }, event.character);
    const goal = records[event.goal_id];
    if (!goal || !eligibleGoalStates.includes(goal.state) || goal.goal_kind !== event.goal_kind) {
      const error = new Error(`Phase70A target goal ${event.goal_id} is invalid during replay.`);
      error.code = "WORLD_SIMULATION_GOAL_ACHIEVEMENT_TARGET_INVALID";
      throw error;
    }
    const source = latestGoalEvent(worldState, event.character, event.goal_id);
    if (!source
        || source.goal_event_id !== event.source_goal_event_id
        || source.goal_event_hash !== event.source_goal_event_hash) {
      const error = new Error(`Phase70A achievement ${event.goal_achievement_event_id} does not pin the current canonical source goal event.`);
      error.code = "WORLD_SIMULATION_GOAL_ACHIEVEMENT_SOURCE_GOAL_INVALID";
      throw error;
    }
    goal.achieved = true;
    goal.latest_achievement_event_id = event.goal_achievement_event_id;
  });
  const projection = {
    version: effectiveMotivationalGoalLifecycleProjectionVersion,
    source_phase68d_projection_version: phase68d.version,
    goals_by_character: goalsByCharacter,
    achievement_history_hash: hashAgentRunValue(achievements.history),
    replayed_achievement_event_count: achievements.history.length,
    replayable_projection: true,
    achievement_is_explicit: true,
    achieved_is_terminal_v1: true,
    abandonment_remains_distinct: true,
    action_success_implies_goal_achievement: false,
    plan_fulfillment_implies_goal_achievement: false,
    plan_completion_implies_goal_achievement: false,
    failure_or_unattainability_modeled: false,
    numeric_progress_score_modeled: false,
  };
  projection.projection_hash = hashAgentRunValue(projection);
  return deepFreeze(projection);
}

function evidenceEntries(kind, values, turnId) {
  return array(values).slice(0, 64).map((raw, index) => {
    const evidence = sanitizeEvidence(raw);
    const evidenceHash = hashAgentRunValue(evidence);
    return {
      evidence_kind: kind,
      evidence_index: index,
      evidence_ref: `phase70a_evidence_${hashAgentRunValue({ version: worldSimulationGoalAchievementVerificationVersion, turn_id: turnId, kind, index, evidence_hash: evidenceHash }).slice(0, 24)}`,
      evidence_hash: evidenceHash,
      evidence,
    };
  });
}

export function buildWorldSimulationGoalAchievementResolverView(input = {}) {
  const worldState = cloneJson(object(input.world_state));
  const turnId = boundedString(input.turn_id, "turn_id");
  const lifecycle = projectWorldSimulationEffectiveMotivationalGoalLifecycle({ world_state: worldState });
  const goals = [];
  for (const [character, records] of Object.entries(lifecycle.goals_by_character ?? {})) {
    for (const goal of Object.values(object(records))) {
      if (goal.achieved === true
          || goalAlreadyUnattainable(worldState, character, goal.goal_id)
          || !eligibleGoalStates.includes(goal.state)
          || !eligibleGoalKinds.includes(goal.goal_kind)) continue;
      const source = latestGoalEvent(worldState, character, goal.goal_id);
      if (!source) continue;
      const descriptor = {
        character,
        goal_id: goal.goal_id,
        goal_kind: goal.goal_kind,
        domain: goal.domain,
        target_descriptor: cloneJson(goal.target_descriptor),
        state: goal.state,
        source_goal_event_id: source.goal_event_id,
        source_goal_event_hash: source.goal_event_hash,
      };
      goals.push({
        goal_ref: `phase70a_goal_${hashAgentRunValue({ version: worldSimulationGoalAchievementVerificationVersion, descriptor }).slice(0, 24)}`,
        ...descriptor,
      });
    }
  }
  const evidence = [
    ...evidenceEntries("causal_state_transition", input.state_transitions, turnId),
    ...evidenceEntries("action_outcome", input.action_outcomes, turnId),
    ...evidenceEntries("knowledge_transition", input.knowledge_transitions, turnId),
  ];
  const view = {
    version: worldSimulationGoalAchievementVerificationVersion,
    turn_id: turnId,
    goal_projection_hash: lifecycle.projection_hash,
    eligible_goals: goals,
    authoritative_evidence: evidence,
    supported_operations: [...supportedOperations],
    eligible_goal_kinds: [...eligibleGoalKinds],
    eligible_goal_states: [...eligibleGoalStates],
    explicit_achievement_required: true,
    evidence_ref_required: true,
    maintain_or_avoid_terminal_achievement_supported: false,
    action_success_implies_goal_achievement: false,
    plan_fulfillment_implies_goal_achievement: false,
    plan_completion_implies_goal_achievement: false,
    failure_or_unattainability_requested: false,
    raw_world_state_exposed: false,
    raw_memory_store_exposed: false,
    hidden_retrieval_graph_exposed: false,
    numeric_scoring_requested: false,
    action_selection_requested: false,
    replanning_requested: false,
  };
  view.resolver_view_hash = hashAgentRunValue(view);
  return deepFreeze(view);
}

function buildAuthoritativeValidationContext(resolverView) {
  const authoritativeEvidence = array(resolverView.authoritative_evidence)
    .map((entry) => ({
      evidence_kind: entry.evidence_kind,
      evidence_index: entry.evidence_index,
      evidence_ref: entry.evidence_ref,
      evidence_hash: entry.evidence_hash,
      evidence: cloneJson(entry.evidence),
    }))
    .sort((left, right) => compareText(left.evidence_kind, right.evidence_kind)
      || Number(left.evidence_index) - Number(right.evidence_index)
      || compareText(left.evidence_ref, right.evidence_ref));
  const context = {
    version: worldSimulationGoalAchievementVerificationVersion,
    turn_id: resolverView.turn_id,
    resolver_view_hash: resolverView.resolver_view_hash,
    goal_projection_hash: resolverView.goal_projection_hash,
    authoritative_evidence: authoritativeEvidence,
    bounded_current_turn_evidence_catalog: true,
    raw_world_state_exposed: false,
  };
  context.context_hash = hashAgentRunValue(context);
  return deepFreeze(context);
}

function normalizeDecision(raw, resolverView, lifecycle) {
  if (!isObject(raw)) {
    const error = new Error("Phase70A achievement decision must be an object.");
    error.code = "WORLD_SIMULATION_GOAL_ACHIEVEMENT_DECISION_INVALID";
    throw error;
  }
  if ((raw.operation ?? "achieve") !== "achieve") {
    const error = new Error(`Unsupported Phase70A operation ${raw.operation}.`);
    error.code = "WORLD_SIMULATION_GOAL_ACHIEVEMENT_OPERATION_UNSUPPORTED";
    throw error;
  }
  const goalRef = boundedString(raw.goal_ref, "goal_ref", 180, "WORLD_SIMULATION_GOAL_ACHIEVEMENT_TARGET_INVALID");
  const goal = resolverView.eligible_goals.find((candidate) => candidate.goal_ref === goalRef);
  if (!goal) {
    const error = new Error(`Unknown or ineligible Phase70A goal ref ${goalRef}.`);
    error.code = "WORLD_SIMULATION_GOAL_ACHIEVEMENT_TARGET_INVALID";
    throw error;
  }
  const records = findCharacterGoals(lifecycle, goal.character);
  const current = records[goal.goal_id];
  if (!current || current.achieved === true || !eligibleGoalStates.includes(current.state) || !eligibleGoalKinds.includes(current.goal_kind)) {
    const error = new Error(`Phase70A target goal ${goal.goal_id} is unavailable or already achieved.`);
    error.code = "WORLD_SIMULATION_GOAL_ACHIEVEMENT_TARGET_INVALID";
    throw error;
  }
  const rawRefs = array(raw.evidence_refs);
  if (!rawRefs.length || rawRefs.length > 16) {
    const error = new Error("Phase70A achievement requires one to sixteen explicit evidence refs.");
    error.code = "WORLD_SIMULATION_GOAL_ACHIEVEMENT_EVIDENCE_REF_INVALID";
    throw error;
  }
  const evidenceMap = new Map(resolverView.authoritative_evidence.map((entry) => [entry.evidence_ref, entry]));
  const selected = [];
  const seen = new Set();
  for (const rawRef of rawRefs) {
    const ref = boundedString(rawRef, "evidence_ref", 180, "WORLD_SIMULATION_GOAL_ACHIEVEMENT_EVIDENCE_REF_INVALID");
    const evidence = evidenceMap.get(ref);
    if (!evidence || seen.has(ref)) {
      const error = new Error(`Phase70A evidence ref ${ref} is non-canonical or duplicated.`);
      error.code = "WORLD_SIMULATION_GOAL_ACHIEVEMENT_EVIDENCE_REF_INVALID";
      throw error;
    }
    seen.add(ref);
    selected.push({ evidence_kind: evidence.evidence_kind, evidence_ref: evidence.evidence_ref, evidence_hash: evidence.evidence_hash });
  }
  selected.sort((left, right) => compareText(left.evidence_ref, right.evidence_ref));
  selected.sort((left, right) => compareText(left.evidence_kind, right.evidence_kind)
    || compareText(left.evidence_ref, right.evidence_ref)
    || compareText(left.evidence_hash, right.evidence_hash));
  return {
    character: goal.character,
    operation: "achieve",
    goal_id: goal.goal_id,
    goal_kind: goal.goal_kind,
    source_goal_event_id: goal.source_goal_event_id,
    source_goal_event_hash: goal.source_goal_event_hash,
    goal_projection_hash: resolverView.goal_projection_hash,
    achievement_evidence_refs: selected,
    resolver_view_hash: resolverView.resolver_view_hash,
    reason: optionalString(raw.reason) ?? "explicit_programmatic_goal_condition_verification",
    source: optionalString(raw.source) ?? "programmatic_goal_achievement_resolver",
  };
}

function eventFor(decision, previous, turnId) {
  const base = {
    schema_version: motivationalGoalAchievementEventSchemaVersion,
    version: worldSimulationGoalAchievementVerificationVersion,
    immutable: true,
    character: decision.character,
    source_turn_id: turnId,
    operation: "achieve",
    goal_id: decision.goal_id,
    goal_kind: decision.goal_kind,
    source_goal_event_id: decision.source_goal_event_id,
    source_goal_event_hash: decision.source_goal_event_hash,
    goal_projection_hash: decision.goal_projection_hash,
    achievement_evidence_refs: cloneJson(decision.achievement_evidence_refs),
    resolver_view_hash: decision.resolver_view_hash,
    previous_goal_achievement_event_id: previous?.goal_achievement_event_id ?? null,
    previous_goal_achievement_event_hash: previous?.goal_achievement_event_hash ?? null,
    achievement_evidence: {
      decision_source: decision.source,
      decision_reason: decision.reason,
      explicit_goal_condition_verification: true,
    },
    explicit_goal_condition_verification: true,
    action_success_implies_goal_achievement: false,
    plan_fulfillment_implies_goal_achievement: false,
    plan_completion_implies_goal_achievement: false,
    failure_or_unattainability_modeled: false,
    world_state_scanned: false,
    numeric_scoring_modeled: false,
    character_brain_direct_write: false,
    status: "motivational_goal_achievement_recorded",
  };
  const eventId = `motivational_goal_achievement_event_${hashAgentRunValue({
    version: worldSimulationGoalAchievementVerificationVersion,
    character: characterKey(decision.character),
    source_turn_id: turnId,
    goal_id: decision.goal_id,
    evidence_refs: decision.achievement_evidence_refs,
    previous_goal_achievement_event_hash: previous?.goal_achievement_event_hash ?? null,
  }).slice(0, 24)}`;
  const event = { ...base, goal_achievement_event_id: eventId };
  event.goal_achievement_event_hash = achievementEventHash(event);
  return deepFreeze(event);
}

function historyRefFor(event) {
  return deepFreeze({
    schema_version: motivationalGoalAchievementHistoryReferenceSchemaVersion,
    derived_index: true,
    goal_achievement_event_id: event.goal_achievement_event_id,
    goal_achievement_event_hash: event.goal_achievement_event_hash,
    goal_id: event.goal_id,
    character: event.character,
    source_turn_id: event.source_turn_id,
    operation: event.operation,
    previous_goal_achievement_event_id: event.previous_goal_achievement_event_id,
    previous_goal_achievement_event_hash: event.previous_goal_achievement_event_hash,
    status: event.status,
  });
}

export function buildWorldSimulationGoalAchievementVerificationContract() {
  return deepFreeze({
    version: worldSimulationGoalAchievementVerificationVersion,
    phase: "Phase70A",
    status: "explicit_goal_achievement_verification_installed",
    supported_operations: [...supportedOperations],
    eligible_goal_kinds: [...eligibleGoalKinds],
    eligible_goal_states: [...eligibleGoalStates],
    explicit_achievement_required: true,
    authoritative_evidence_ref_required: true,
    immutable_achievement_event_write_once_required: true,
    append_only_achievement_history_required: true,
    per_character_previous_event_hash_chain_required: true,
    achieved_is_terminal_v1: true,
    abandonment_remains_distinct: true,
    maintain_or_avoid_terminal_achievement_supported: false,
    action_success_implies_goal_achievement: false,
    plan_fulfillment_implies_goal_achievement: false,
    plan_completion_implies_goal_achievement: false,
    failure_or_unattainability_modeled: false,
    autonomous_replanning_modeled: false,
    numeric_progress_utility_probability_confidence_modeled: false,
    raw_world_state_scan_allowed: false,
    character_brain_direct_durable_write_allowed: false,
    authoritative_mutation_owner: "phase62k-authoritative-mutation-executor-v1",
    deterministic_replay_required: true,
    input_immutability_required: true,
  });
}

export function buildWorldSimulationGoalAchievementEvents(input = {}) {
  const worldState = cloneJson(object(input.world_state));
  const turnId = boundedString(input.turn_id, "turn_id");
  const rawDecisions = array(input.achievement_decisions);
  const resolverView = input.resolver_view ? cloneJson(input.resolver_view) : buildWorldSimulationGoalAchievementResolverView({
    world_state: worldState,
    turn_id: turnId,
    state_transitions: input.state_transitions,
    action_outcomes: input.action_outcomes,
    knowledge_transitions: input.knowledge_transitions,
  });
  const canonicalHash = hashAgentRunValue(Object.fromEntries(Object.entries(resolverView).filter(([key]) => key !== "resolver_view_hash")));
  if (resolverView.version !== worldSimulationGoalAchievementVerificationVersion
      || resolverView.turn_id !== turnId
      || canonicalHash !== resolverView.resolver_view_hash) {
    const error = new Error("Phase70A requires an exact canonical achievement resolver view.");
    error.code = "WORLD_SIMULATION_GOAL_ACHIEVEMENT_RESOLVER_VIEW_INVALID";
    throw error;
  }
  const inputSnapshot = cloneJson({ world_state: worldState, turn_id: turnId, achievement_decisions: rawDecisions, resolver_view: resolverView });
  const inputHash = hashAgentRunValue(inputSnapshot);
  const existing = validateAchievementHistory(worldState);
  const lifecycle = projectWorldSimulationEffectiveMotivationalGoalLifecycle({ world_state: worldState });
  const decisions = rawDecisions.map((decision) => normalizeDecision(decision, resolverView, lifecycle));
  const seenGoalKeys = new Set();
  for (const decision of decisions) {
    const key = `${characterKey(decision.character)}\u0000${decision.goal_id}`;
    if (goalAlreadyUnattainable(worldState, decision.character, decision.goal_id)) {
      const error = new Error(
        `Phase70A goal ${decision.goal_id} is already terminally unattainable in this world lineage.`,
      );
      error.code = "WORLD_SIMULATION_GOAL_ACHIEVEMENT_TARGET_UNATTAINABLE";
      throw error;
    }
    if (existing.achievedGoals.has(key) || seenGoalKeys.has(key)) {
      const error = new Error(`Phase70A goal ${decision.goal_id} may be achieved only once.`);
      error.code = "WORLD_SIMULATION_GOAL_ACHIEVEMENT_DUPLICATE_FORBIDDEN";
      throw error;
    }
    seenGoalKeys.add(key);
  }
  const preview = cloneJson(worldState);
  const latestByCharacter = new Map(existing.latestByCharacter);
  const createdEvents = [];
  const appendedReferences = [];
  const stateTransitions = [];
  for (const decision of decisions) {
    const event = eventFor(decision, latestByCharacter.get(characterKey(decision.character)) ?? null, turnId);
    preview.motivational_goal_achievement_events = object(preview.motivational_goal_achievement_events);
    if (preview.motivational_goal_achievement_events[event.goal_achievement_event_id]) {
      const error = new Error(`Phase70A achievement event ${event.goal_achievement_event_id} already exists.`);
      error.code = "WORLD_SIMULATION_GOAL_ACHIEVEMENT_EVENT_IMMUTABILITY_VIOLATION";
      throw error;
    }
    preview.motivational_goal_achievement_events[event.goal_achievement_event_id] = cloneJson(event);
    const ref = historyRefFor(event);
    createdEvents.push(event);
    appendedReferences.push(ref);
    latestByCharacter.set(characterKey(event.character), event);
    stateTransitions.push({
      entity: "world",
      field: `motivational_goal_achievement_events.${event.goal_achievement_event_id}`,
      from: null,
      to: cloneJson(event),
      cause: `persist immutable MotivationalGoalAchievementEvent ${event.goal_achievement_event_id}`,
      source_layer: "goal_achievement_verification",
    });
  }
  if (appendedReferences.length) {
    const nextHistory = [...existing.history.map(cloneJson), ...appendedReferences.map(cloneJson)];
    preview.motivational_goal_achievement_history = nextHistory;
    stateTransitions.push({
      entity: "world",
      field: "motivational_goal_achievement_history",
      from: cloneJson(worldState.motivational_goal_achievement_history ?? null),
      to: cloneJson(nextHistory),
      cause: `append ${appendedReferences.length} Phase70A goal-achievement history reference(s)`,
      source_layer: "goal_achievement_verification",
    });
  }
  const effectiveLifecycle = projectWorldSimulationEffectiveMotivationalGoalLifecycle({ world_state: preview });
  if (hashAgentRunValue(inputSnapshot) !== inputHash) {
    const error = new Error("Phase70A goal achievement verification mutated its input snapshot.");
    error.code = "WORLD_SIMULATION_GOAL_ACHIEVEMENT_INPUT_MUTATED";
    throw error;
  }
  const authoritativeValidationContext = buildAuthoritativeValidationContext(resolverView);
  return deepFreeze({
    ok: true,
    version: worldSimulationGoalAchievementVerificationVersion,
    result: {
      achievement_decision_count: decisions.length,
      achievement_events_created: createdEvents,
      history_references_appended: appendedReferences,
      state_transitions: stateTransitions,
      preview_world_state: preview,
      resolver_view_hash: resolverView.resolver_view_hash,
      authoritative_validation_context: authoritativeValidationContext,
      effective_goal_lifecycle_projection: effectiveLifecycle,
      audit: {
        explicit_goal_condition_verification: true,
        evidence_ref_required: true,
        phase62k_validation_context_emitted: true,
        action_success_implies_goal_achievement: false,
        plan_fulfillment_implies_goal_achievement: false,
        plan_completion_implies_goal_achievement: false,
        failure_or_unattainability_modeled: false,
        raw_world_state_scanned: false,
        numeric_scoring_modeled: false,
      },
    },
  });
}

function assertNoSameTurnAchievement(worldState, character, currentTurnId) {
  for (const ref of array(worldState.motivational_goal_achievement_history)) {
    if (sameCharacter(ref?.character, character) && ref?.source_turn_id === currentTurnId) {
      const error = new Error(`Phase70A cannot expose achieved goal state after same-turn write for ${character}.`);
      error.code = "WORLD_SIMULATION_GOAL_ACHIEVEMENT_SAME_TURN_CONTAMINATION";
      throw error;
    }
  }
}

export function projectWorldSimulationMotivationalGoalLifecycleForCharacter(input = {}) {
  const worldState = cloneJson(object(input.world_state));
  const character = boundedString(input.character, "character");
  const currentTurnId = boundedString(input.current_turn_id, "current_turn_id");
  const inputHash = hashAgentRunValue(worldState);
  assertNoSameTurnAchievement(worldState, character, currentTurnId);
  const lifecycle = projectWorldSimulationEffectiveMotivationalGoalLifecycle({ world_state: worldState });
  const records = Object.values(findCharacterGoals(lifecycle, character))
    .filter((record) => ["committed", "suspended"].includes(record.state) && record.achieved !== true)
    .sort((left, right) => Number(right.latest_history_index) - Number(left.latest_history_index)
      || compareText(left.domain, right.domain));
  const selected = records.slice(0, motivationalGoalLifecycleMaxCharacterItems);
  const goals = selected.map((record) => ({
    goal_kind: record.goal_kind,
    domain: record.domain,
    target: cloneJson(record.target_descriptor),
    state: record.state,
    motivation_relations: cloneJson(record.motivation_relations),
    achieved: false,
    subjective_not_world_truth: true,
  }));
  const characterView = {
    source: "committed_prior_turn_effective_motivational_goal_lifecycle",
    goals,
    goals_truncated: selected.length < records.length,
    achieved_goals_hidden: true,
    proposed_candidates_hidden: true,
    numeric_utility_priority_probability_exposed: false,
    action_plan_exposed: false,
    selected_action_authority_exposed: false,
  };
  if (hashAgentRunValue(worldState) !== inputHash) {
    const error = new Error("Phase70A bounded goal lifecycle projection mutated its input.");
    error.code = "WORLD_SIMULATION_GOAL_ACHIEVEMENT_INPUT_MUTATED";
    throw error;
  }
  return deepFreeze({
    ok: true,
    version: motivationalGoalLifecycleCharacterProjectionVersion,
    source_projection_version: effectiveMotivationalGoalLifecycleProjectionVersion,
    character,
    current_turn_id: currentTurnId,
    character_view: characterView,
    character_view_hash: hashAgentRunValue(characterView),
    audit: {
      source_projection_hash: lifecycle.projection_hash,
      source_goal_count: records.length,
      projected_goal_count: selected.length,
      achieved_goals_exposed: false,
      goal_ids_exposed: false,
      goal_event_ids_exposed: false,
      achievement_event_ids_exposed: false,
      source_ids_hashes_exposed: false,
      numeric_utility_priority_probability_exposed: false,
      action_plan_exposed: false,
      selected_action_authority_exposed: false,
      same_turn_feedback_allowed: false,
    },
  });
}
