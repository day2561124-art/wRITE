import { hashAgentRunValue } from "./agent-run-service.mjs";
import {
  projectWorldSimulationEffectiveMotivationalGoalViability,
} from "./world-simulation-goal-viability-unattainability-service.mjs";

export const worldSimulationGoalDisengagementReengagementVersion =
  "phase70c-goal-disengagement-reengagement-v1";
export const motivationalGoalAdjustmentEventSchemaVersion =
  "phase70c-motivational-goal-adjustment-event-v1";
export const motivationalGoalAdjustmentHistoryReferenceSchemaVersion =
  "phase70c-motivational-goal-adjustment-history-ref-v1";
export const effectiveMotivationalGoalAdjustmentProjectionVersion =
  "phase70c-effective-motivational-goal-adjustment-projection-v1";

const supportedOperations = Object.freeze([
  "disengage_unattainable",
  "reengage_alternative",
]);
const eligibleSourceStates = Object.freeze(["committed", "suspended"]);
const eligibleAlternativeStates = Object.freeze(["committed"]);

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function object(value) { return isObject(value) ? value : {}; }
function array(value) { return Array.isArray(value) ? value : []; }
function cloneJson(value) { return JSON.parse(JSON.stringify(value ?? null)); }
function optionalString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}
function boundedString(
  value,
  label,
  maxLength = 240,
  code = "WORLD_SIMULATION_GOAL_ADJUSTMENT_INPUT_INVALID",
) {
  const text = optionalString(value);
  if (!text || text.length > maxLength) {
    const error = new Error(
      `${label} must be a non-empty string no longer than ${maxLength} characters.`,
    );
    error.code = code;
    throw error;
  }
  return text;
}
function characterKey(value) {
  return boundedString(value, "character").toLocaleLowerCase("zh-Hant-TW");
}
function sameCharacter(left, right) {
  return characterKey(left) === characterKey(right);
}
function compareText(left, right) {
  return String(left ?? "").localeCompare(String(right ?? ""), "en");
}
function hashWithout(value, field) {
  const body = cloneJson(value);
  delete body[field];
  return hashAgentRunValue(body);
}
function adjustmentEventHash(event) {
  return hashWithout(event, "goal_adjustment_event_hash");
}
function goalKey(character, goalId) {
  return `${characterKey(character)}\u0000${String(goalId ?? "").trim()}`;
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

function unattainabilityEventForGoal(worldState, goal) {
  const eventId = optionalString(goal?.latest_unattainability_event_id);
  if (!eventId) return null;
  const event = object(object(worldState.motivational_goal_unattainability_events)[eventId]);
  if (event.goal_unattainability_event_id !== eventId
      || !optionalString(event.goal_unattainability_event_hash)
      || event.goal_id !== goal.goal_id
      || !sameCharacter(event.character, goal.character)
      || event.status !== "motivational_goal_unattainability_recorded") {
    return null;
  }
  return event;
}

function validatePersistedAdjustmentEvent(event, eventId) {
  const targetFieldsPresent = optionalString(event?.target_goal_id)
    && optionalString(event?.target_goal_event_id)
    && optionalString(event?.target_goal_event_hash);
  const disengagementFieldsPresent = optionalString(event?.source_disengagement_event_id)
    && optionalString(event?.source_disengagement_event_hash);
  if (!isObject(event)
      || event.schema_version !== motivationalGoalAdjustmentEventSchemaVersion
      || event.version !== worldSimulationGoalDisengagementReengagementVersion
      || event.immutable !== true
      || event.goal_adjustment_event_id !== eventId
      || !optionalString(event.goal_adjustment_event_hash)
      || !optionalString(event.character)
      || !optionalString(event.source_turn_id)
      || !supportedOperations.includes(event.operation)
      || !optionalString(event.source_goal_ref)
      || !optionalString(event.source_goal_id)
      || !optionalString(event.source_goal_kind)
      || !optionalString(event.source_goal_event_id)
      || !optionalString(event.source_goal_event_hash)
      || !optionalString(event.source_goal_unattainability_event_id)
      || !optionalString(event.source_goal_unattainability_event_hash)
      || !optionalString(event.source_unattainability_basis_kind)
      || !optionalString(event.goal_viability_projection_hash)
      || !optionalString(event.resolver_view_hash)
      || event.explicit_goal_adjustment !== true
      || event.unattainability_implies_disengagement !== false
      || event.action_failure_implies_disengagement !== false
      || event.plan_failure_implies_disengagement !== false
      || event.lack_of_progress_implies_disengagement !== false
      || event.same_goal_reengagement_allowed !== false
      || event.new_goal_created !== false
      || event.goal_commitment_created !== false
      || event.goal_state_mutated !== false
      || event.automatic_replanning !== false
      || event.numeric_scoring_modeled !== false
      || event.world_state_scanned !== false
      || event.character_brain_direct_write !== false
      || event.status !== "motivational_goal_adjustment_recorded") {
    const error = new Error(`MotivationalGoalAdjustmentEvent ${eventId} is invalid.`);
    error.code = "WORLD_SIMULATION_GOAL_ADJUSTMENT_EVENT_INVALID";
    throw error;
  }
  if (event.operation === "disengage_unattainable") {
    if (event.alternative_goal_ref !== null
        || event.target_goal_id !== null
        || event.target_goal_event_id !== null
        || event.target_goal_event_hash !== null
        || event.source_disengagement_event_id !== null
        || event.source_disengagement_event_hash !== null) {
      const error = new Error(`Phase70C disengagement event ${eventId} contains reengagement-only fields.`);
      error.code = "WORLD_SIMULATION_GOAL_ADJUSTMENT_EVENT_INVALID";
      throw error;
    }
  } else if (!optionalString(event.alternative_goal_ref)
      || !targetFieldsPresent
      || !disengagementFieldsPresent
      || event.target_goal_id === event.source_goal_id) {
    const error = new Error(`Phase70C reengagement event ${eventId} lacks a distinct alternative goal or prior disengagement.`);
    error.code = "WORLD_SIMULATION_GOAL_ADJUSTMENT_EVENT_INVALID";
    throw error;
  }
  if (adjustmentEventHash(event) !== event.goal_adjustment_event_hash) {
    const error = new Error(`MotivationalGoalAdjustmentEvent ${eventId} failed hash verification.`);
    error.code = "WORLD_SIMULATION_GOAL_ADJUSTMENT_EVENT_HASH_MISMATCH";
    throw error;
  }
  return event;
}

function validateAdjustmentHistory(worldState) {
  if (Object.hasOwn(worldState, "motivational_goal_adjustment_events")
      && !isObject(worldState.motivational_goal_adjustment_events)) {
    const error = new Error("motivational_goal_adjustment_events must be an object.");
    error.code = "WORLD_SIMULATION_GOAL_ADJUSTMENT_EVENT_STORE_INVALID";
    throw error;
  }
  if (Object.hasOwn(worldState, "motivational_goal_adjustment_history")
      && !Array.isArray(worldState.motivational_goal_adjustment_history)) {
    const error = new Error("motivational_goal_adjustment_history must be an array.");
    error.code = "WORLD_SIMULATION_GOAL_ADJUSTMENT_HISTORY_INVALID";
    throw error;
  }
  const events = object(worldState.motivational_goal_adjustment_events);
  const history = array(worldState.motivational_goal_adjustment_history);
  const latestByCharacter = new Map();
  const disengagedSources = new Set();
  const reengagedSources = new Set();
  const disengagementEventBySource = new Map();
  const seenEventIds = new Set();
  for (const [index, ref] of history.entries()) {
    if (!isObject(ref)
        || ref.schema_version !== motivationalGoalAdjustmentHistoryReferenceSchemaVersion
        || ref.derived_index !== true
        || !optionalString(ref.goal_adjustment_event_id)
        || !optionalString(ref.goal_adjustment_event_hash)
        || !optionalString(ref.character)
        || !optionalString(ref.source_turn_id)
        || !supportedOperations.includes(ref.operation)
        || !optionalString(ref.source_goal_id)
        || ref.status !== "motivational_goal_adjustment_recorded") {
      const error = new Error(`motivational_goal_adjustment_history[${index}] is invalid.`);
      error.code = "WORLD_SIMULATION_GOAL_ADJUSTMENT_HISTORY_REFERENCE_INVALID";
      throw error;
    }
    if (seenEventIds.has(ref.goal_adjustment_event_id)) {
      const error = new Error(`Duplicate Phase70C event ${ref.goal_adjustment_event_id}.`);
      error.code = "WORLD_SIMULATION_GOAL_ADJUSTMENT_IDENTITY_REUSE_FORBIDDEN";
      throw error;
    }
    const event = validatePersistedAdjustmentEvent(
      events[ref.goal_adjustment_event_id],
      ref.goal_adjustment_event_id,
    );
    const char = characterKey(event.character);
    const sourceKey = goalKey(event.character, event.source_goal_id);
    const previous = latestByCharacter.get(char) ?? null;
    if (ref.goal_adjustment_event_hash !== event.goal_adjustment_event_hash
        || ref.character !== event.character
        || ref.source_turn_id !== event.source_turn_id
        || ref.operation !== event.operation
        || ref.source_goal_id !== event.source_goal_id
        || (ref.target_goal_id ?? null) !== (event.target_goal_id ?? null)
        || ref.previous_goal_adjustment_event_id !== event.previous_goal_adjustment_event_id
        || ref.previous_goal_adjustment_event_hash !== event.previous_goal_adjustment_event_hash
        || event.previous_goal_adjustment_event_id !== (previous?.goal_adjustment_event_id ?? null)
        || event.previous_goal_adjustment_event_hash !== (previous?.goal_adjustment_event_hash ?? null)) {
      const error = new Error(`Phase70C history reference ${ref.goal_adjustment_event_id} breaks its per-character chain.`);
      error.code = "WORLD_SIMULATION_GOAL_ADJUSTMENT_HISTORY_REFERENCE_MISMATCH";
      throw error;
    }
    if (event.operation === "disengage_unattainable") {
      if (disengagedSources.has(sourceKey)) {
        const error = new Error(`Phase70C goal ${event.source_goal_id} was disengaged more than once.`);
        error.code = "WORLD_SIMULATION_GOAL_DISENGAGEMENT_DUPLICATE_FORBIDDEN";
        throw error;
      }
      disengagedSources.add(sourceKey);
      disengagementEventBySource.set(sourceKey, event);
    } else {
      const disengagement = disengagementEventBySource.get(sourceKey);
      if (!disengagement
          || reengagedSources.has(sourceKey)
          || event.source_disengagement_event_id !== disengagement.goal_adjustment_event_id
          || event.source_disengagement_event_hash !== disengagement.goal_adjustment_event_hash
          || event.source_turn_id === disengagement.source_turn_id) {
        const error = new Error(`Phase70C reengagement for ${event.source_goal_id} lacks a prior committed disengagement or is duplicated.`);
        error.code = "WORLD_SIMULATION_GOAL_REENGAGEMENT_SOURCE_INVALID";
        throw error;
      }
      reengagedSources.add(sourceKey);
    }
    seenEventIds.add(event.goal_adjustment_event_id);
    latestByCharacter.set(char, event);
  }
  return {
    events,
    history,
    latestByCharacter,
    disengagedSources,
    reengagedSources,
    disengagementEventBySource,
    seenEventIds,
  };
}

export function projectWorldSimulationEffectiveMotivationalGoalAdjustment(input = {}) {
  const worldState = cloneJson(object(input.world_state));
  const viability = projectWorldSimulationEffectiveMotivationalGoalViability({
    world_state: worldState,
  });
  const adjustment = validateAdjustmentHistory(worldState);
  const goalsByCharacter = cloneJson(viability.goals_by_character);
  for (const records of Object.values(goalsByCharacter)) {
    for (const record of Object.values(object(records))) {
      record.goal_adjustment_state = "unadjusted";
      record.disengaged = false;
      record.latest_goal_adjustment_event_id = null;
      record.disengagement_event_id = null;
      record.reengaged_from_goal_ids = [];
    }
  }
  for (const ref of adjustment.history) {
    const event = adjustment.events[ref.goal_adjustment_event_id];
    const records = findCharacterGoals({ goals_by_character: goalsByCharacter }, event.character);
    const source = records[event.source_goal_id];
    if (!source
        || source.achieved === true
        || source.unattainable !== true
        || !eligibleSourceStates.includes(source.state)
        || source.goal_kind !== event.source_goal_kind) {
      const error = new Error(`Phase70C source goal ${event.source_goal_id} is invalid during replay.`);
      error.code = "WORLD_SIMULATION_GOAL_ADJUSTMENT_SOURCE_INVALID";
      throw error;
    }
    const sourceGoalEvent = latestGoalEvent(worldState, event.character, event.source_goal_id);
    const sourceUnattainability = unattainabilityEventForGoal(worldState, source);
    if (!sourceGoalEvent
        || sourceGoalEvent.goal_event_id !== event.source_goal_event_id
        || sourceGoalEvent.goal_event_hash !== event.source_goal_event_hash
        || !sourceUnattainability
        || sourceUnattainability.goal_unattainability_event_id
          !== event.source_goal_unattainability_event_id
        || sourceUnattainability.goal_unattainability_event_hash
          !== event.source_goal_unattainability_event_hash
        || sourceUnattainability.unattainability_basis_kind
          !== event.source_unattainability_basis_kind) {
      const error = new Error(`Phase70C event ${event.goal_adjustment_event_id} does not pin canonical source provenance.`);
      error.code = "WORLD_SIMULATION_GOAL_ADJUSTMENT_SOURCE_PROVENANCE_INVALID";
      throw error;
    }
    if (event.operation === "disengage_unattainable") {
      source.goal_adjustment_state = "disengaged";
      source.disengaged = true;
      source.disengagement_event_id = event.goal_adjustment_event_id;
      source.latest_goal_adjustment_event_id = event.goal_adjustment_event_id;
      continue;
    }
    const target = records[event.target_goal_id];
    if (!target
        || event.target_goal_id === event.source_goal_id
        || target.state !== "committed"
        || target.achieved === true
        || target.unattainable === true) {
      const error = new Error(`Phase70C alternative goal ${event.target_goal_id} is invalid during replay.`);
      error.code = "WORLD_SIMULATION_GOAL_REENGAGEMENT_TARGET_INVALID";
      throw error;
    }
    const targetGoalEvent = latestGoalEvent(worldState, event.character, event.target_goal_id);
    if (!targetGoalEvent
        || targetGoalEvent.goal_event_id !== event.target_goal_event_id
        || targetGoalEvent.goal_event_hash !== event.target_goal_event_hash) {
      const error = new Error(`Phase70C reengagement ${event.goal_adjustment_event_id} does not pin the canonical alternative goal.`);
      error.code = "WORLD_SIMULATION_GOAL_REENGAGEMENT_TARGET_PROVENANCE_INVALID";
      throw error;
    }
    source.goal_adjustment_state = "disengaged";
    source.disengaged = true;
    source.latest_goal_adjustment_event_id = event.goal_adjustment_event_id;
    target.goal_adjustment_state = "reengaged_alternative";
    target.latest_goal_adjustment_event_id = event.goal_adjustment_event_id;
    target.reengaged_from_goal_ids = [...new Set([
      ...array(target.reengaged_from_goal_ids),
      event.source_goal_id,
    ])].sort(compareText);
  }
  const projection = {
    version: effectiveMotivationalGoalAdjustmentProjectionVersion,
    source_phase70b_projection_version: viability.version,
    source_phase70b_projection_hash: viability.projection_hash,
    goals_by_character: goalsByCharacter,
    adjustment_history_hash: hashAgentRunValue(adjustment.history),
    replayed_adjustment_event_count: adjustment.history.length,
    replayable_projection: true,
    phase68d_state_remains_authoritative: true,
    unattainability_is_not_disengagement: true,
    disengagement_is_explicit: true,
    reengagement_requires_distinct_existing_goal: true,
    same_goal_reengagement_allowed: false,
    new_goal_creation_modeled: false,
    replanning_modeled: false,
    numeric_scoring_modeled: false,
  };
  projection.projection_hash = hashAgentRunValue(projection);
  return deepFreeze(projection);
}

function sourceDescriptor(worldState, viability, goal, character) {
  const sourceGoalEvent = latestGoalEvent(worldState, character, goal.goal_id);
  const unattainability = unattainabilityEventForGoal(worldState, goal);
  if (!sourceGoalEvent || !unattainability) return null;
  return {
    character,
    source_goal_id: goal.goal_id,
    source_goal_kind: goal.goal_kind,
    source_goal_state: goal.state,
    source_goal_event_id: sourceGoalEvent.goal_event_id,
    source_goal_event_hash: sourceGoalEvent.goal_event_hash,
    source_goal_unattainability_event_id: unattainability.goal_unattainability_event_id,
    source_goal_unattainability_event_hash: unattainability.goal_unattainability_event_hash,
    source_unattainability_basis_kind: unattainability.unattainability_basis_kind,
    domain: goal.domain,
    target_descriptor: cloneJson(goal.target_descriptor),
    motivation_relations: cloneJson(goal.motivation_relations),
    goal_viability_projection_hash: viability.projection_hash,
  };
}

export function buildWorldSimulationGoalAdjustmentResolverView(input = {}) {
  const worldState = cloneJson(object(input.world_state));
  const turnId = boundedString(input.turn_id, "turn_id");
  const viability = projectWorldSimulationEffectiveMotivationalGoalViability({
    world_state: worldState,
  });
  const adjustment = validateAdjustmentHistory(worldState);
  const disengageCandidates = [];
  const reengageSources = [];
  const alternativeGoals = [];
  for (const [character, records] of Object.entries(viability.goals_by_character ?? {})) {
    for (const goal of Object.values(object(records))) {
      const key = goalKey(character, goal.goal_id);
      if (goal.unattainable === true
          && goal.achieved !== true
          && eligibleSourceStates.includes(goal.state)) {
        const descriptor = sourceDescriptor(worldState, viability, goal, character);
        if (!descriptor) continue;
        if (!adjustment.disengagedSources.has(key)) {
          disengageCandidates.push({
            source_goal_ref: `phase70c_source_${hashAgentRunValue({
              version: worldSimulationGoalDisengagementReengagementVersion,
              operation: "disengage_unattainable",
              descriptor,
            }).slice(0, 24)}`,
            ...descriptor,
          });
        } else if (!adjustment.reengagedSources.has(key)) {
          const disengagement = adjustment.disengagementEventBySource.get(key);
          if (disengagement) {
            reengageSources.push({
              source_goal_ref: `phase70c_source_${hashAgentRunValue({
                version: worldSimulationGoalDisengagementReengagementVersion,
                operation: "reengage_alternative",
                descriptor,
                source_disengagement_event_id: disengagement.goal_adjustment_event_id,
                source_disengagement_event_hash: disengagement.goal_adjustment_event_hash,
              }).slice(0, 24)}`,
              ...descriptor,
              source_disengagement_event_id: disengagement.goal_adjustment_event_id,
              source_disengagement_event_hash: disengagement.goal_adjustment_event_hash,
            });
          }
        }
      }
      if (goal.state === "committed"
          && goal.achieved !== true
          && goal.unattainable !== true) {
        const sourceGoalEvent = latestGoalEvent(worldState, character, goal.goal_id);
        if (!sourceGoalEvent) continue;
        const descriptor = {
          character,
          target_goal_id: goal.goal_id,
          target_goal_kind: goal.goal_kind,
          target_goal_event_id: sourceGoalEvent.goal_event_id,
          target_goal_event_hash: sourceGoalEvent.goal_event_hash,
          domain: goal.domain,
          target_descriptor: cloneJson(goal.target_descriptor),
          motivation_relations: cloneJson(goal.motivation_relations),
        };
        alternativeGoals.push({
          alternative_goal_ref: `phase70c_alternative_${hashAgentRunValue({
            version: worldSimulationGoalDisengagementReengagementVersion,
            descriptor,
          }).slice(0, 24)}`,
          ...descriptor,
        });
      }
    }
  }
  const sortSource = (left, right) => compareText(characterKey(left.character), characterKey(right.character))
    || compareText(left.source_goal_id, right.source_goal_id);
  disengageCandidates.sort(sortSource);
  reengageSources.sort(sortSource);
  alternativeGoals.sort((left, right) => compareText(characterKey(left.character), characterKey(right.character))
    || compareText(left.target_goal_id, right.target_goal_id));
  const view = {
    version: worldSimulationGoalDisengagementReengagementVersion,
    turn_id: turnId,
    goal_viability_projection_hash: viability.projection_hash,
    disengage_candidates: disengageCandidates,
    reengage_sources: reengageSources,
    alternative_goals: alternativeGoals,
    supported_operations: [...supportedOperations],
    source_goal_unattainability_required: true,
    reengagement_requires_prior_committed_disengagement: true,
    same_turn_disengage_reengage_allowed: false,
    same_goal_reengagement_allowed: false,
    alternative_goal_must_already_be_committed: true,
    new_goal_creation_requested: false,
    goal_commitment_creation_requested: false,
    action_failure_trigger_requested: false,
    plan_failure_trigger_requested: false,
    lack_of_progress_trigger_requested: false,
    replanning_requested: false,
    raw_world_state_exposed: false,
    raw_memory_store_exposed: false,
    hidden_retrieval_graph_exposed: false,
    implementation_plan_internals_exposed: false,
    numeric_scoring_requested: false,
  };
  view.resolver_view_hash = hashAgentRunValue(view);
  return deepFreeze(view);
}

function buildAuthoritativeValidationContext(resolverView) {
  const context = {
    version: worldSimulationGoalDisengagementReengagementVersion,
    turn_id: resolverView.turn_id,
    resolver_view_hash: resolverView.resolver_view_hash,
    goal_viability_projection_hash: resolverView.goal_viability_projection_hash,
    disengage_candidates: cloneJson(resolverView.disengage_candidates),
    reengage_sources: cloneJson(resolverView.reengage_sources),
    alternative_goals: cloneJson(resolverView.alternative_goals),
    bounded_prior_committed_goal_catalog: true,
    raw_world_state_exposed: false,
  };
  context.context_hash = hashAgentRunValue(context);
  return deepFreeze(context);
}

function normalizeDecision(raw, resolverView) {
  if (!isObject(raw)) {
    const error = new Error("Phase70C goal-adjustment decision must be an object.");
    error.code = "WORLD_SIMULATION_GOAL_ADJUSTMENT_DECISION_INVALID";
    throw error;
  }
  const operation = boundedString(
    raw.operation,
    "operation",
    80,
    "WORLD_SIMULATION_GOAL_ADJUSTMENT_OPERATION_UNSUPPORTED",
  );
  if (!supportedOperations.includes(operation)) {
    const error = new Error(`Unsupported Phase70C operation ${operation}.`);
    error.code = "WORLD_SIMULATION_GOAL_ADJUSTMENT_OPERATION_UNSUPPORTED";
    throw error;
  }
  const sourceGoalRef = boundedString(
    raw.source_goal_ref,
    "source_goal_ref",
    180,
    "WORLD_SIMULATION_GOAL_ADJUSTMENT_SOURCE_INVALID",
  );
  const sourceCatalog = operation === "disengage_unattainable"
    ? resolverView.disengage_candidates
    : resolverView.reengage_sources;
  const source = sourceCatalog.find((entry) => entry.source_goal_ref === sourceGoalRef);
  if (!source) {
    const error = new Error(`Unknown or ineligible Phase70C source goal ref ${sourceGoalRef}.`);
    error.code = "WORLD_SIMULATION_GOAL_ADJUSTMENT_SOURCE_INVALID";
    throw error;
  }
  let target = null;
  let alternativeGoalRef = null;
  if (operation === "reengage_alternative") {
    alternativeGoalRef = boundedString(
      raw.alternative_goal_ref,
      "alternative_goal_ref",
      180,
      "WORLD_SIMULATION_GOAL_REENGAGEMENT_TARGET_INVALID",
    );
    target = resolverView.alternative_goals.find(
      (entry) => entry.alternative_goal_ref === alternativeGoalRef,
    );
    if (!target
        || !sameCharacter(target.character, source.character)
        || target.target_goal_id === source.source_goal_id) {
      const error = new Error("Phase70C reengagement target must be a distinct same-character existing committed goal.");
      error.code = "WORLD_SIMULATION_GOAL_REENGAGEMENT_TARGET_INVALID";
      throw error;
    }
  }
  return {
    character: source.character,
    operation,
    source_goal_ref: sourceGoalRef,
    source_goal_id: source.source_goal_id,
    source_goal_kind: source.source_goal_kind,
    source_goal_event_id: source.source_goal_event_id,
    source_goal_event_hash: source.source_goal_event_hash,
    source_goal_unattainability_event_id: source.source_goal_unattainability_event_id,
    source_goal_unattainability_event_hash: source.source_goal_unattainability_event_hash,
    source_unattainability_basis_kind: source.source_unattainability_basis_kind,
    goal_viability_projection_hash: resolverView.goal_viability_projection_hash,
    alternative_goal_ref: alternativeGoalRef,
    target_goal_id: target?.target_goal_id ?? null,
    target_goal_event_id: target?.target_goal_event_id ?? null,
    target_goal_event_hash: target?.target_goal_event_hash ?? null,
    source_disengagement_event_id: source.source_disengagement_event_id ?? null,
    source_disengagement_event_hash: source.source_disengagement_event_hash ?? null,
    resolver_view_hash: resolverView.resolver_view_hash,
    reason: optionalString(raw.reason) ?? "explicit_programmatic_goal_adjustment",
    source: optionalString(raw.source) ?? "programmatic_goal_adjustment_resolver",
  };
}

function eventFor(decision, previous, turnId) {
  const base = {
    schema_version: motivationalGoalAdjustmentEventSchemaVersion,
    version: worldSimulationGoalDisengagementReengagementVersion,
    immutable: true,
    character: decision.character,
    source_turn_id: turnId,
    operation: decision.operation,
    source_goal_ref: decision.source_goal_ref,
    source_goal_id: decision.source_goal_id,
    source_goal_kind: decision.source_goal_kind,
    source_goal_event_id: decision.source_goal_event_id,
    source_goal_event_hash: decision.source_goal_event_hash,
    source_goal_unattainability_event_id: decision.source_goal_unattainability_event_id,
    source_goal_unattainability_event_hash: decision.source_goal_unattainability_event_hash,
    source_unattainability_basis_kind: decision.source_unattainability_basis_kind,
    goal_viability_projection_hash: decision.goal_viability_projection_hash,
    alternative_goal_ref: decision.alternative_goal_ref,
    target_goal_id: decision.target_goal_id,
    target_goal_event_id: decision.target_goal_event_id,
    target_goal_event_hash: decision.target_goal_event_hash,
    source_disengagement_event_id: decision.source_disengagement_event_id,
    source_disengagement_event_hash: decision.source_disengagement_event_hash,
    resolver_view_hash: decision.resolver_view_hash,
    previous_goal_adjustment_event_id: previous?.goal_adjustment_event_id ?? null,
    previous_goal_adjustment_event_hash: previous?.goal_adjustment_event_hash ?? null,
    adjustment_evidence: {
      decision_source: decision.source,
      decision_reason: decision.reason,
      explicit_goal_adjustment: true,
      source_unattainability_required: true,
    },
    explicit_goal_adjustment: true,
    unattainability_implies_disengagement: false,
    action_failure_implies_disengagement: false,
    plan_failure_implies_disengagement: false,
    lack_of_progress_implies_disengagement: false,
    same_goal_reengagement_allowed: false,
    new_goal_created: false,
    goal_commitment_created: false,
    goal_state_mutated: false,
    automatic_replanning: false,
    numeric_scoring_modeled: false,
    world_state_scanned: false,
    character_brain_direct_write: false,
    status: "motivational_goal_adjustment_recorded",
  };
  const eventId = `motivational_goal_adjustment_event_${hashAgentRunValue({
    version: worldSimulationGoalDisengagementReengagementVersion,
    character: characterKey(decision.character),
    source_turn_id: turnId,
    operation: decision.operation,
    source_goal_id: decision.source_goal_id,
    target_goal_id: decision.target_goal_id,
    source_disengagement_event_hash: decision.source_disengagement_event_hash,
    previous_goal_adjustment_event_hash: previous?.goal_adjustment_event_hash ?? null,
  }).slice(0, 24)}`;
  const event = { ...base, goal_adjustment_event_id: eventId };
  event.goal_adjustment_event_hash = adjustmentEventHash(event);
  return deepFreeze(event);
}

function historyRefFor(event) {
  return deepFreeze({
    schema_version: motivationalGoalAdjustmentHistoryReferenceSchemaVersion,
    derived_index: true,
    goal_adjustment_event_id: event.goal_adjustment_event_id,
    goal_adjustment_event_hash: event.goal_adjustment_event_hash,
    character: event.character,
    source_turn_id: event.source_turn_id,
    operation: event.operation,
    source_goal_id: event.source_goal_id,
    target_goal_id: event.target_goal_id,
    previous_goal_adjustment_event_id: event.previous_goal_adjustment_event_id,
    previous_goal_adjustment_event_hash: event.previous_goal_adjustment_event_hash,
    status: event.status,
  });
}

export function buildWorldSimulationGoalDisengagementReengagementContract() {
  return deepFreeze({
    version: worldSimulationGoalDisengagementReengagementVersion,
    phase: "Phase70C",
    status: "explicit_goal_disengagement_reengagement_installed",
    supported_operations: [...supportedOperations],
    eligible_source_states: [...eligibleSourceStates],
    eligible_alternative_states: [...eligibleAlternativeStates],
    explicit_goal_adjustment_required: true,
    unattainability_is_not_disengagement: true,
    disengagement_requires_phase70b_unattainability: true,
    reengagement_requires_prior_committed_disengagement: true,
    reengagement_requires_distinct_existing_committed_goal: true,
    same_turn_disengage_reengage_allowed: false,
    same_goal_reengagement_allowed: false,
    phase68d_goal_state_rewritten: false,
    phase68d_abandon_event_auto_created: false,
    new_goal_creation_modeled: false,
    goal_commitment_creation_modeled: false,
    action_failure_triggered_disengagement: false,
    plan_failure_triggered_disengagement: false,
    lack_of_progress_triggered_disengagement: false,
    replanning_modeled: false,
    numeric_persistence_utility_probability_modeled: false,
    immutable_adjustment_event_write_once_required: true,
    append_only_adjustment_history_required: true,
    per_character_previous_event_hash_chain_required: true,
    authoritative_mutation_owner: "phase62k-authoritative-mutation-executor-v1",
    prior_turn_committed_resolver_view_only: true,
    deterministic_replay_required: true,
    input_immutability_required: true,
  });
}

export function buildWorldSimulationGoalAdjustmentEvents(input = {}) {
  const worldState = cloneJson(object(input.world_state));
  const turnId = boundedString(input.turn_id, "turn_id");
  const rawDecisions = array(input.adjustment_decisions);
  const resolverView = input.resolver_view
    ? cloneJson(input.resolver_view)
    : buildWorldSimulationGoalAdjustmentResolverView({
      world_state: worldState,
      turn_id: turnId,
    });
  const canonicalHash = hashAgentRunValue(
    Object.fromEntries(
      Object.entries(resolverView).filter(([key]) => key !== "resolver_view_hash"),
    ),
  );
  if (resolverView.version !== worldSimulationGoalDisengagementReengagementVersion
      || resolverView.turn_id !== turnId
      || canonicalHash !== resolverView.resolver_view_hash) {
    const error = new Error("Phase70C requires an exact canonical goal-adjustment resolver view.");
    error.code = "WORLD_SIMULATION_GOAL_ADJUSTMENT_RESOLVER_VIEW_INVALID";
    throw error;
  }
  const inputSnapshot = cloneJson({
    world_state: worldState,
    turn_id: turnId,
    adjustment_decisions: rawDecisions,
    resolver_view: resolverView,
  });
  const inputHash = hashAgentRunValue(inputSnapshot);
  const existing = validateAdjustmentHistory(worldState);
  const currentViability = projectWorldSimulationEffectiveMotivationalGoalViability({
    world_state: worldState,
  });
  const decisions = rawDecisions.map((decision) => normalizeDecision(decision, resolverView));
  const seenSourceKeys = new Set();
  for (const decision of decisions) {
    const key = goalKey(decision.character, decision.source_goal_id);
    if (seenSourceKeys.has(key)) {
      const error = new Error(`Phase70C permits at most one adjustment per source goal per turn: ${decision.source_goal_id}.`);
      error.code = "WORLD_SIMULATION_GOAL_ADJUSTMENT_PER_GOAL_TURN_LIMIT";
      throw error;
    }
    seenSourceKeys.add(key);
    const records = findCharacterGoals(currentViability, decision.character);
    const source = records[decision.source_goal_id];
    const sourceGoalEvent = latestGoalEvent(worldState, decision.character, decision.source_goal_id);
    const sourceUnattainability = source ? unattainabilityEventForGoal(worldState, source) : null;
    if (!source
        || source.achieved === true
        || source.unattainable !== true
        || !eligibleSourceStates.includes(source.state)
        || source.goal_kind !== decision.source_goal_kind
        || !sourceGoalEvent
        || sourceGoalEvent.goal_event_id !== decision.source_goal_event_id
        || sourceGoalEvent.goal_event_hash !== decision.source_goal_event_hash
        || !sourceUnattainability
        || sourceUnattainability.goal_unattainability_event_id
          !== decision.source_goal_unattainability_event_id
        || sourceUnattainability.goal_unattainability_event_hash
          !== decision.source_goal_unattainability_event_hash
        || sourceUnattainability.unattainability_basis_kind
          !== decision.source_unattainability_basis_kind) {
      const error = new Error(`Phase70C source goal ${decision.source_goal_id} is not a canonical unattainable goal.`);
      error.code = "WORLD_SIMULATION_GOAL_ADJUSTMENT_SOURCE_INVALID";
      throw error;
    }
    if (decision.operation === "disengage_unattainable") {
      if (existing.disengagedSources.has(key)) {
        const error = new Error(`Phase70C source goal ${decision.source_goal_id} is already disengaged.`);
        error.code = "WORLD_SIMULATION_GOAL_DISENGAGEMENT_DUPLICATE_FORBIDDEN";
        throw error;
      }
    } else {
      const disengagement = existing.disengagementEventBySource.get(key);
      if (!disengagement
          || existing.reengagedSources.has(key)
          || decision.source_disengagement_event_id !== disengagement.goal_adjustment_event_id
          || decision.source_disengagement_event_hash !== disengagement.goal_adjustment_event_hash
          || disengagement.source_turn_id === turnId) {
        const error = new Error(`Phase70C source goal ${decision.source_goal_id} lacks a prior committed disengagement.`);
        error.code = "WORLD_SIMULATION_GOAL_REENGAGEMENT_SOURCE_INVALID";
        throw error;
      }
      const target = records[decision.target_goal_id];
      const targetGoalEvent = latestGoalEvent(worldState, decision.character, decision.target_goal_id);
      if (!target
          || decision.target_goal_id === decision.source_goal_id
          || target.state !== "committed"
          || target.achieved === true
          || target.unattainable === true
          || !targetGoalEvent
          || targetGoalEvent.goal_event_id !== decision.target_goal_event_id
          || targetGoalEvent.goal_event_hash !== decision.target_goal_event_hash) {
        const error = new Error(`Phase70C alternative goal ${decision.target_goal_id} is not a viable same-character committed goal.`);
        error.code = "WORLD_SIMULATION_GOAL_REENGAGEMENT_TARGET_INVALID";
        throw error;
      }
    }
  }
  const preview = cloneJson(worldState);
  const latestByCharacter = new Map(existing.latestByCharacter);
  const createdEvents = [];
  const appendedReferences = [];
  const stateTransitions = [];
  for (const decision of decisions) {
    const event = eventFor(
      decision,
      latestByCharacter.get(characterKey(decision.character)) ?? null,
      turnId,
    );
    preview.motivational_goal_adjustment_events = object(
      preview.motivational_goal_adjustment_events,
    );
    if (preview.motivational_goal_adjustment_events[event.goal_adjustment_event_id]) {
      const error = new Error(`Phase70C event ${event.goal_adjustment_event_id} already exists.`);
      error.code = "WORLD_SIMULATION_GOAL_ADJUSTMENT_EVENT_IMMUTABILITY_VIOLATION";
      throw error;
    }
    preview.motivational_goal_adjustment_events[event.goal_adjustment_event_id] = cloneJson(event);
    const ref = historyRefFor(event);
    createdEvents.push(event);
    appendedReferences.push(ref);
    latestByCharacter.set(characterKey(event.character), event);
    stateTransitions.push({
      entity: "world",
      field: `motivational_goal_adjustment_events.${event.goal_adjustment_event_id}`,
      from: null,
      to: cloneJson(event),
      cause: `persist immutable MotivationalGoalAdjustmentEvent ${event.goal_adjustment_event_id}`,
      source_layer: "goal_disengagement_reengagement",
    });
  }
  if (appendedReferences.length) {
    const nextHistory = [
      ...existing.history.map(cloneJson),
      ...appendedReferences.map(cloneJson),
    ];
    preview.motivational_goal_adjustment_history = nextHistory;
    stateTransitions.push({
      entity: "world",
      field: "motivational_goal_adjustment_history",
      from: cloneJson(worldState.motivational_goal_adjustment_history ?? null),
      to: cloneJson(nextHistory),
      cause: `append ${appendedReferences.length} Phase70C goal-adjustment history reference(s)`,
      source_layer: "goal_disengagement_reengagement",
    });
  }
  const effectiveAdjustment = projectWorldSimulationEffectiveMotivationalGoalAdjustment({
    world_state: preview,
  });
  if (hashAgentRunValue(inputSnapshot) !== inputHash) {
    const error = new Error("Phase70C goal adjustment mutated its input snapshot.");
    error.code = "WORLD_SIMULATION_GOAL_ADJUSTMENT_INPUT_MUTATED";
    throw error;
  }
  const authoritativeValidationContext = buildAuthoritativeValidationContext(resolverView);
  return deepFreeze({
    ok: true,
    version: worldSimulationGoalDisengagementReengagementVersion,
    result: {
      adjustment_decision_count: decisions.length,
      adjustment_events_created: createdEvents,
      history_references_appended: appendedReferences,
      state_transitions: stateTransitions,
      preview_world_state: preview,
      resolver_view_hash: resolverView.resolver_view_hash,
      authoritative_validation_context: authoritativeValidationContext,
      effective_goal_adjustment_projection: effectiveAdjustment,
      audit: {
        explicit_goal_adjustment: true,
        unattainability_implies_disengagement: false,
        action_failure_implies_disengagement: false,
        plan_failure_implies_disengagement: false,
        lack_of_progress_implies_disengagement: false,
        same_goal_reengagement_allowed: false,
        reengagement_requires_prior_committed_disengagement: true,
        new_goal_created: false,
        goal_commitment_created: false,
        phase68d_goal_state_mutated: false,
        phase68d_abandon_event_created: false,
        automatic_replanning: false,
        numeric_scoring_modeled: false,
        phase62k_validation_context_emitted: true,
      },
    },
  });
}
