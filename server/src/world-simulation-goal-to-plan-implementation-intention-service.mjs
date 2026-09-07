import { hashAgentRunValue } from "./agent-run-service.mjs";
import { projectWorldSimulationEffectiveMotivationalGoals } from "./world-simulation-motivation-goal-integration-service.mjs";

export const worldSimulationGoalImplementationIntentionVersion = "phase69a-goal-implementation-intention-v1";
export const goalImplementationIntentionEventSchemaVersion = "phase69a-goal-implementation-intention-event-v1";
export const goalImplementationIntentionHistoryReferenceSchemaVersion = "phase69a-goal-implementation-intention-history-ref-v1";
export const effectiveGoalImplementationIntentionProjectionVersion = "phase69a-effective-goal-implementation-intention-projection-v1";
export const goalImplementationIntentionCharacterProjectionVersion = "phase69a-bounded-goal-implementation-intention-character-projection-v1";
export const goalImplementationIntentionMaxCharacterItems = 8;

const supportedCueKinds = Object.freeze(["situation", "opportunity", "obstacle", "task_juncture", "internal_state"]);
const supportedResponseKinds = Object.freeze(["initiate_behavior", "cognitive_procedure", "communication", "avoidance", "seek_support"]);

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
function boundedString(value, label, maxLength = 180, code = "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_INPUT_INVALID") {
  const text = optionalString(value);
  if (!text || text.length > maxLength) {
    const error = new Error(`${label} must be a non-empty string no longer than ${maxLength} characters.`);
    error.code = code;
    throw error;
  }
  return text;
}
function characterKey(value) { return boundedString(value, "character", 240).toLocaleLowerCase("zh-Hant-TW"); }
function sameCharacter(left, right) { return characterKey(left) === characterKey(right); }
function compareText(left, right) { return String(left ?? "").localeCompare(String(right ?? ""), "en"); }
function hashWithout(value, field) { const body = cloneJson(value); delete body[field]; return hashAgentRunValue(body); }
function planEventHash(event) { return hashWithout(event, "implementation_intention_event_hash"); }

function normalizeDescriptor(raw, kindField, supportedKinds, label) {
  if (!isObject(raw)) {
    const error = new Error(`${label} must be an object.`);
    error.code = "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_DESCRIPTOR_INVALID";
    throw error;
  }
  const kind = boundedString(raw[kindField], `${label}.${kindField}`, 80, "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_DESCRIPTOR_INVALID");
  if (!supportedKinds.includes(kind)) {
    const error = new Error(`Unsupported Phase69A ${kindField} ${kind}.`);
    error.code = "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_DESCRIPTOR_INVALID";
    throw error;
  }
  const text = boundedString(raw.label, `${label}.label`, 200, "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_DESCRIPTOR_INVALID");
  const context = optionalString(raw.context);
  if (context && context.length > 240) {
    const error = new Error(`${label}.context exceeds the Phase69A bound.`);
    error.code = "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_DESCRIPTOR_INVALID";
    throw error;
  }
  for (const forbidden of ["action_id", "mutation", "mutation_path", "world_state_patch", "outcome", "utility", "priority", "probability", "timestamp_ms"]) {
    if (Object.hasOwn(raw, forbidden)) {
      const error = new Error(`${label} may not contain executable or numeric authority field ${forbidden}.`);
      error.code = "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_EXECUTION_AUTHORITY_FORBIDDEN";
      throw error;
    }
  }
  return { [kindField]: kind, label: text, context: context ?? null };
}
function normalizeCue(raw) { return normalizeDescriptor(raw, "cue_kind", supportedCueKinds, "cue_descriptor"); }
function normalizeResponse(raw) { return normalizeDescriptor(raw, "response_kind", supportedResponseKinds, "response_descriptor"); }

function latestCommittedGoalSources(worldState) {
  const projection = projectWorldSimulationEffectiveMotivationalGoals({ world_state: worldState });
  const result = [];
  for (const [character, records] of Object.entries(projection.goals_by_character ?? {})) {
    for (const record of Object.values(object(records))) {
      if (record.state !== "committed") continue;
      const history = array(worldState.motivational_goal_history);
      let sourceEvent = null;
      for (let index = history.length - 1; index >= 0; index -= 1) {
        const ref = history[index];
        if (ref?.goal_id !== record.goal_id || !sameCharacter(ref?.character, character)) continue;
        const event = object(object(worldState.motivational_goal_events)[ref.goal_event_id]);
        if (event.operation === "commit") sourceEvent = event;
        break;
      }
      if (!sourceEvent || !optionalString(sourceEvent.goal_event_hash)) continue;
      result.push({
        source_kind: "phase68d_committed_motivational_goal_event",
        source_event_id: sourceEvent.goal_event_id,
        source_event_hash: sourceEvent.goal_event_hash,
        goal_id: record.goal_id,
        character,
        character_view: {
          goal_kind: record.goal_kind,
          domain: record.domain,
          target: cloneJson(record.target_descriptor),
          subjective_not_world_truth: true,
        },
      });
    }
  }
  return result.sort((left, right) => characterKey(left.character).localeCompare(characterKey(right.character))
    || compareText(left.goal_id, right.goal_id));
}

function validatePersistedEvent(event, eventId) {
  if (!isObject(event)
      || event.schema_version !== goalImplementationIntentionEventSchemaVersion
      || event.version !== worldSimulationGoalImplementationIntentionVersion
      || event.immutable !== true
      || event.implementation_intention_event_id !== eventId
      || !optionalString(event.implementation_intention_event_hash)
      || !optionalString(event.implementation_intention_id)
      || !optionalString(event.character)
      || !optionalString(event.source_turn_id)
      || event.operation !== "form"
      || !optionalString(event.goal_id)
      || !optionalString(event.source_goal_event_id)
      || !optionalString(event.source_goal_event_hash)
      || !isObject(event.cue_descriptor)
      || !isObject(event.response_descriptor)
      || !optionalString(event.resolver_view_hash)
      || event.subjective_prospective_plan !== true
      || event.world_truth_verified !== false
      || event.source_goal_committed_at_formation !== true
      || event.selected_action_authority !== false
      || event.executable_action_id !== null
      || event.utility_score !== null
      || event.priority_score !== null
      || event.success_probability !== null
      || event.feasibility_score !== null
      || event.character_brain_direct_write !== false
      || event.status !== "goal_implementation_intention_recorded") {
    const error = new Error(`GoalImplementationIntentionEvent ${eventId} is invalid.`);
    error.code = "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_EVENT_INVALID";
    throw error;
  }
  normalizeCue(event.cue_descriptor);
  normalizeResponse(event.response_descriptor);
  if (planEventHash(event) !== event.implementation_intention_event_hash) {
    const error = new Error(`GoalImplementationIntentionEvent ${eventId} failed hash verification.`);
    error.code = "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_EVENT_HASH_MISMATCH";
    throw error;
  }
  return event;
}

function validateHistory(worldState) {
  if (Object.hasOwn(worldState, "goal_implementation_intention_events") && !isObject(worldState.goal_implementation_intention_events)) {
    const error = new Error("goal_implementation_intention_events must be an object.");
    error.code = "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_EVENT_STORE_INVALID";
    throw error;
  }
  if (Object.hasOwn(worldState, "goal_implementation_intention_history") && !Array.isArray(worldState.goal_implementation_intention_history)) {
    const error = new Error("goal_implementation_intention_history must be an array.");
    error.code = "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_HISTORY_INVALID";
    throw error;
  }
  const events = object(worldState.goal_implementation_intention_events);
  const history = array(worldState.goal_implementation_intention_history);
  const latestByCharacter = new Map();
  const seenEventIds = new Set();
  const seenPlanIds = new Set();
  for (const [index, ref] of history.entries()) {
    if (!isObject(ref)
        || ref.schema_version !== goalImplementationIntentionHistoryReferenceSchemaVersion
        || ref.derived_index !== true
        || !optionalString(ref.implementation_intention_event_id)
        || !optionalString(ref.implementation_intention_event_hash)
        || !optionalString(ref.implementation_intention_id)
        || !optionalString(ref.goal_id)
        || !optionalString(ref.character)
        || !optionalString(ref.source_turn_id)
        || ref.operation !== "form"
        || ref.status !== "goal_implementation_intention_recorded") {
      const error = new Error(`goal_implementation_intention_history[${index}] is invalid.`);
      error.code = "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_HISTORY_REFERENCE_INVALID";
      throw error;
    }
    if (seenEventIds.has(ref.implementation_intention_event_id) || seenPlanIds.has(ref.implementation_intention_id)) {
      const error = new Error("Phase69A implementation-intention identity reuse is forbidden.");
      error.code = "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_IDENTITY_REUSE_FORBIDDEN";
      throw error;
    }
    const event = validatePersistedEvent(events[ref.implementation_intention_event_id], ref.implementation_intention_event_id);
    const key = characterKey(event.character);
    const previous = latestByCharacter.get(key) ?? null;
    if (ref.implementation_intention_event_hash !== event.implementation_intention_event_hash
        || ref.implementation_intention_id !== event.implementation_intention_id
        || ref.goal_id !== event.goal_id
        || ref.character !== event.character
        || ref.source_turn_id !== event.source_turn_id
        || ref.previous_implementation_intention_event_id !== event.previous_implementation_intention_event_id
        || ref.previous_implementation_intention_event_hash !== event.previous_implementation_intention_event_hash
        || event.previous_implementation_intention_event_id !== (previous?.implementation_intention_event_id ?? null)
        || event.previous_implementation_intention_event_hash !== (previous?.implementation_intention_event_hash ?? null)) {
      const error = new Error(`Phase69A history reference ${ref.implementation_intention_event_id} breaks its per-character chain.`);
      error.code = "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_HISTORY_REFERENCE_MISMATCH";
      throw error;
    }
    seenEventIds.add(event.implementation_intention_event_id);
    seenPlanIds.add(event.implementation_intention_id);
    latestByCharacter.set(key, event);
  }
  return { events, history, latestByCharacter, seenPlanIds };
}

export function projectWorldSimulationEffectiveGoalImplementationIntentions(input = {}) {
  const worldState = cloneJson(object(input.world_state));
  const validated = validateHistory(worldState);
  const goals = projectWorldSimulationEffectiveMotivationalGoals({ world_state: worldState });
  const plansByCharacter = {};
  validated.history.forEach((ref, historyIndex) => {
    const event = validated.events[ref.implementation_intention_event_id];
    plansByCharacter[event.character] ??= {};
    const goalRecord = object(object(goals.goals_by_character?.[event.character])[event.goal_id]);
    const sourceGoalCommitted = goalRecord.state === "committed";
    plansByCharacter[event.character][event.implementation_intention_id] = {
      implementation_intention_id: event.implementation_intention_id,
      character: event.character,
      goal_id: event.goal_id,
      cue_descriptor: cloneJson(event.cue_descriptor),
      response_descriptor: cloneJson(event.response_descriptor),
      state: sourceGoalCommitted ? "active" : "inactive_source_goal_not_committed",
      latest_history_index: historyIndex,
      subjective_prospective_plan: true,
      selected_action_authority: false,
    };
  });
  const projection = {
    version: effectiveGoalImplementationIntentionProjectionVersion,
    source_version: worldSimulationGoalImplementationIntentionVersion,
    plans_by_character: plansByCharacter,
    source_history_hash: hashAgentRunValue(validated.history),
    replayed_event_count: validated.history.length,
    replayable_projection: true,
    source_goal_commitment_controls_activity: true,
    historical_plan_rewrite_on_goal_change: false,
    multiple_plans_per_goal_allowed: true,
    last_write_wins_applied: false,
    action_selection_authority_claimed: false,
    executable_action_ids_modeled: false,
    numeric_utility_priority_probability_feasibility_modeled: false,
    world_truth_authority_claimed: false,
  };
  projection.projection_hash = hashAgentRunValue(projection);
  return deepFreeze(projection);
}

function findCharacterPlans(projection, character) {
  for (const [name, records] of Object.entries(projection.plans_by_character ?? {})) {
    if (sameCharacter(name, character)) return object(records);
  }
  return {};
}

export function buildWorldSimulationGoalImplementationIntentionResolverView(input = {}) {
  const worldState = cloneJson(object(input.world_state));
  const turnId = boundedString(input.turn_id, "turn_id", 240);
  const committed = latestCommittedGoalSources(worldState);
  const view = {
    version: worldSimulationGoalImplementationIntentionVersion,
    turn_id: turnId,
    committed_goal_sources: committed.map(cloneJson),
    supported_operations: ["form"],
    supported_cue_kinds: [...supportedCueKinds],
    supported_response_kinds: [...supportedResponseKinds],
    committed_goal_required: true,
    same_character_goal_required: true,
    raw_world_state_exposed: false,
    raw_world_event_exposed: false,
    raw_memory_content_exposed: false,
    hidden_retrieval_graph_exposed: false,
    executable_action_ids_exposed: false,
    mutation_authority_exposed: false,
    numeric_utility_requested: false,
    feasibility_judgment_requested: false,
    selected_action_requested: false,
  };
  view.resolver_view_hash = hashAgentRunValue(view);
  return deepFreeze(view);
}

function normalizeDecision(raw, resolverView, existing) {
  if (!isObject(raw)) {
    const error = new Error("Phase69A implementation-intention decision must be an object.");
    error.code = "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_DECISION_INVALID";
    throw error;
  }
  const character = boundedString(raw.character, "decision.character", 240, "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_DECISION_INVALID");
  if ((raw.operation ?? "form") !== "form") {
    const error = new Error(`Unsupported Phase69A operation ${raw.operation}.`);
    error.code = "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_OPERATION_UNSUPPORTED";
    throw error;
  }
  const resolverViewHash = boundedString(raw.resolver_view_hash ?? resolverView.resolver_view_hash, "resolver_view_hash", 128,
    "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_RESOLVER_VIEW_HASH_REQUIRED");
  if (resolverViewHash !== resolverView.resolver_view_hash) {
    const error = new Error("Phase69A decision does not pin the canonical resolver view.");
    error.code = "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_RESOLVER_VIEW_HASH_MISMATCH";
    throw error;
  }
  const goalId = boundedString(raw.goal_id, "goal_id", 240, "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_SOURCE_GOAL_INVALID");
  const source = resolverView.committed_goal_sources.find((candidate) => candidate.goal_id === goalId && sameCharacter(candidate.character, character));
  if (!source) {
    const error = new Error(`Phase69A requires a same-character committed source goal: ${goalId}.`);
    error.code = "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_SOURCE_GOAL_NOT_COMMITTED";
    throw error;
  }
  const cue = normalizeCue(raw.cue_descriptor);
  const response = normalizeResponse(raw.response_descriptor);
  const implementationIntentionId = `goal_implementation_intention_${hashAgentRunValue({
    version: worldSimulationGoalImplementationIntentionVersion,
    character: characterKey(character),
    goal_id: goalId,
    source_goal_event_hash: source.source_event_hash,
    cue_descriptor: cue,
    response_descriptor: response,
  }).slice(0, 24)}`;
  if (existing.seenPlanIds.has(implementationIntentionId)) {
    const error = new Error(`Phase69A implementation intention ${implementationIntentionId} already exists.`);
    error.code = "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_IDENTITY_REUSE_FORBIDDEN";
    throw error;
  }
  return {
    character,
    operation: "form",
    implementation_intention_id: implementationIntentionId,
    goal_id: goalId,
    source_goal_event_id: source.source_event_id,
    source_goal_event_hash: source.source_event_hash,
    cue_descriptor: cue,
    response_descriptor: response,
    resolver_view_hash: resolverViewHash,
  };
}

function eventFor(decision, previous, turnId) {
  const base = {
    schema_version: goalImplementationIntentionEventSchemaVersion,
    version: worldSimulationGoalImplementationIntentionVersion,
    immutable: true,
    character: decision.character,
    source_turn_id: turnId,
    operation: "form",
    implementation_intention_id: decision.implementation_intention_id,
    goal_id: decision.goal_id,
    source_goal_event_id: decision.source_goal_event_id,
    source_goal_event_hash: decision.source_goal_event_hash,
    cue_descriptor: cloneJson(decision.cue_descriptor),
    response_descriptor: cloneJson(decision.response_descriptor),
    resolver_view_hash: decision.resolver_view_hash,
    previous_implementation_intention_event_id: previous?.implementation_intention_event_id ?? null,
    previous_implementation_intention_event_hash: previous?.implementation_intention_event_hash ?? null,
    subjective_prospective_plan: true,
    world_truth_verified: false,
    source_goal_committed_at_formation: true,
    selected_action_authority: false,
    executable_action_id: null,
    utility_score: null,
    priority_score: null,
    success_probability: null,
    feasibility_score: null,
    character_brain_direct_write: false,
    status: "goal_implementation_intention_recorded",
  };
  const eventId = `goal_implementation_intention_event_${hashAgentRunValue({
    version: worldSimulationGoalImplementationIntentionVersion,
    character: characterKey(decision.character),
    source_turn_id: turnId,
    implementation_intention_id: decision.implementation_intention_id,
    previous_implementation_intention_event_hash: previous?.implementation_intention_event_hash ?? null,
  }).slice(0, 24)}`;
  const event = { ...base, implementation_intention_event_id: eventId };
  event.implementation_intention_event_hash = planEventHash(event);
  return deepFreeze(event);
}
function historyReferenceFor(event) {
  return deepFreeze({
    schema_version: goalImplementationIntentionHistoryReferenceSchemaVersion,
    derived_index: true,
    implementation_intention_event_id: event.implementation_intention_event_id,
    implementation_intention_event_hash: event.implementation_intention_event_hash,
    implementation_intention_id: event.implementation_intention_id,
    goal_id: event.goal_id,
    character: event.character,
    source_turn_id: event.source_turn_id,
    operation: event.operation,
    previous_implementation_intention_event_id: event.previous_implementation_intention_event_id,
    previous_implementation_intention_event_hash: event.previous_implementation_intention_event_hash,
    status: event.status,
  });
}

export function buildWorldSimulationGoalImplementationIntentionContract() {
  return deepFreeze({
    version: worldSimulationGoalImplementationIntentionVersion,
    phase: "Phase69A",
    status: "goal_to_plan_implementation_intention_foundation_installed",
    supported_operations: ["form"],
    supported_cue_kinds: [...supportedCueKinds],
    supported_response_kinds: [...supportedResponseKinds],
    committed_goal_required: true,
    source_goal_change_deactivates_projection_without_history_rewrite: true,
    multiple_plans_per_goal_allowed: true,
    immutable_plan_event_write_once_required: true,
    append_only_plan_history_required: true,
    per_character_previous_event_hash_chain_required: true,
    selected_action_authority_claimed: false,
    executable_action_ids_modeled: false,
    plan_tree_decomposition_modeled: false,
    numeric_utility_priority_probability_feasibility_modeled: false,
    world_truth_authority_claimed: false,
    separate_retrieval_engine_installed: false,
    hidden_semantic_graph_allowed: false,
    character_brain_direct_durable_write_allowed: false,
    authoritative_mutation_owner: "phase62k-authoritative-mutation-executor-v1",
    committed_prior_turn_character_projection_only: true,
    same_turn_character_brain_feedback_allowed: false,
    deterministic_replay_required: true,
    input_immutability_required: true,
  });
}

export function buildWorldSimulationGoalImplementationIntentionEvents(input = {}) {
  const worldState = cloneJson(object(input.world_state));
  const turnId = boundedString(input.turn_id, "turn_id", 240);
  const rawDecisions = array(input.implementation_intention_decisions);
  const inputSnapshot = cloneJson({ world_state: worldState, turn_id: turnId, implementation_intention_decisions: rawDecisions });
  const inputHash = hashAgentRunValue(inputSnapshot);
  const existing = validateHistory(worldState);
  const resolverView = buildWorldSimulationGoalImplementationIntentionResolverView({ world_state: worldState, turn_id: turnId });
  const decisions = rawDecisions.map((decision) => normalizeDecision(decision, resolverView, existing));
  const existingTurnKeys = new Set(existing.history
    .map((ref) => existing.events[ref.implementation_intention_event_id])
    .filter((event) => event?.source_turn_id === turnId)
    .map((event) => `${characterKey(event.character)}\u0000${event.implementation_intention_id}`));
  const seenTurnKeys = new Set();
  for (const decision of decisions) {
    const key = `${characterKey(decision.character)}\u0000${decision.implementation_intention_id}`;
    if (existingTurnKeys.has(key) || seenTurnKeys.has(key)) {
      const error = new Error(`Phase69A allows at most one durable formation of the same implementation intention per turn.`);
      error.code = "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_PER_TURN_LIMIT";
      throw error;
    }
    seenTurnKeys.add(key);
  }
  const preview = cloneJson(worldState);
  const latestByCharacter = new Map(existing.latestByCharacter);
  const createdEvents = [];
  const appendedReferences = [];
  const stateTransitions = [];
  for (const decision of decisions) {
    const key = characterKey(decision.character);
    const event = eventFor(decision, latestByCharacter.get(key) ?? null, turnId);
    preview.goal_implementation_intention_events = object(preview.goal_implementation_intention_events);
    if (preview.goal_implementation_intention_events[event.implementation_intention_event_id]) {
      const error = new Error(`Phase69A plan event ${event.implementation_intention_event_id} already exists.`);
      error.code = "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_EVENT_IMMUTABILITY_VIOLATION";
      throw error;
    }
    preview.goal_implementation_intention_events[event.implementation_intention_event_id] = cloneJson(event);
    const ref = historyReferenceFor(event);
    createdEvents.push(event);
    appendedReferences.push(ref);
    latestByCharacter.set(key, event);
    stateTransitions.push({
      entity: "world",
      field: `goal_implementation_intention_events.${event.implementation_intention_event_id}`,
      from: null,
      to: cloneJson(event),
      cause: `persist immutable GoalImplementationIntentionEvent ${event.implementation_intention_event_id}`,
      source_layer: "goal_implementation_intention",
    });
  }
  if (appendedReferences.length) {
    const nextHistory = [...existing.history.map(cloneJson), ...appendedReferences.map(cloneJson)];
    preview.goal_implementation_intention_history = nextHistory;
    stateTransitions.push({
      entity: "world",
      field: "goal_implementation_intention_history",
      from: cloneJson(worldState.goal_implementation_intention_history ?? null),
      to: cloneJson(nextHistory),
      cause: `append ${appendedReferences.length} Phase69A implementation-intention history reference(s)`,
      source_layer: "goal_implementation_intention",
    });
  }
  const effectiveProjection = projectWorldSimulationEffectiveGoalImplementationIntentions({ world_state: preview });
  if (hashAgentRunValue(inputSnapshot) !== inputHash) {
    const error = new Error("Phase69A goal-to-plan formation mutated its input snapshot.");
    error.code = "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_INPUT_MUTATED";
    throw error;
  }
  return deepFreeze({
    ok: true,
    version: worldSimulationGoalImplementationIntentionVersion,
    result: {
      implementation_intention_decision_count: decisions.length,
      implementation_intention_events_created: createdEvents,
      history_references_appended: appendedReferences,
      state_transitions: stateTransitions,
      preview_world_state: preview,
      resolver_view_hash: resolverView.resolver_view_hash,
      effective_goal_implementation_intention_projection: effectiveProjection,
      audit: {
        committed_goal_required: true,
        same_character_goal_required: true,
        source_goal_change_deactivates_projection_without_history_rewrite: true,
        selected_action_authority_claimed: false,
        executable_action_ids_modeled: false,
        numeric_utility_priority_probability_feasibility_modeled: false,
        world_truth_authority_claimed: false,
        same_turn_character_brain_feedback_allowed: false,
      },
    },
  });
}

function assertNoSameTurnWrites(worldState, character, currentTurnId) {
  for (const ref of array(worldState.goal_implementation_intention_history)) {
    if (sameCharacter(ref?.character, character) && ref?.source_turn_id === currentTurnId) {
      const error = new Error(`Phase69A cannot expose implementation intentions after same-turn write for ${character}.`);
      error.code = "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_SAME_TURN_CONTAMINATION";
      throw error;
    }
  }
}
export function projectWorldSimulationGoalImplementationIntentionsForCharacter(input = {}) {
  const worldState = cloneJson(object(input.world_state));
  const character = boundedString(input.character, "character", 240);
  const currentTurnId = boundedString(input.current_turn_id, "current_turn_id", 240);
  const inputHash = hashAgentRunValue(worldState);
  assertNoSameTurnWrites(worldState, character, currentTurnId);
  const effective = projectWorldSimulationEffectiveGoalImplementationIntentions({ world_state: worldState });
  const goals = projectWorldSimulationEffectiveMotivationalGoals({ world_state: worldState });
  const characterGoals = object(goals.goals_by_character?.[character]);
  const records = Object.values(findCharacterPlans(effective, character))
    .filter((record) => record.state === "active")
    .sort((left, right) => Number(right.latest_history_index) - Number(left.latest_history_index)
      || compareText(left.implementation_intention_id, right.implementation_intention_id));
  const selected = records.slice(0, goalImplementationIntentionMaxCharacterItems);
  const plans = selected.map((record) => {
    const goal = object(characterGoals[record.goal_id]);
    return {
      source_goal: {
        goal_kind: goal.goal_kind ?? null,
        domain: goal.domain ?? null,
        target: cloneJson(goal.target_descriptor ?? null),
      },
      if_cue: cloneJson(record.cue_descriptor),
      then_response: cloneJson(record.response_descriptor),
      subjective_prospective_plan: true,
      selected_action_authority: false,
    };
  });
  const characterView = {
    source: "committed_prior_turn_effective_goal_implementation_intentions",
    implementation_intentions: plans,
    implementation_intentions_truncated: selected.length < records.length,
    engine_ids_hashes_exposed: false,
    executable_action_ids_exposed: false,
    selected_action_authority_exposed: false,
    numeric_utility_priority_probability_feasibility_exposed: false,
  };
  if (hashAgentRunValue(worldState) !== inputHash) {
    const error = new Error("Phase69A bounded plan projection mutated its input.");
    error.code = "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_INPUT_MUTATED";
    throw error;
  }
  return deepFreeze({
    ok: true,
    version: goalImplementationIntentionCharacterProjectionVersion,
    source_projection_version: effectiveGoalImplementationIntentionProjectionVersion,
    character,
    current_turn_id: currentTurnId,
    character_view: characterView,
    character_view_hash: hashAgentRunValue(characterView),
    audit: {
      source_projection_hash: effective.projection_hash,
      source_plan_count: records.length,
      projected_plan_count: selected.length,
      implementation_intention_ids_exposed: false,
      source_goal_ids_exposed: false,
      source_event_ids_hashes_exposed: false,
      world_truth_authority_exposed: false,
      executable_action_ids_exposed: false,
      selected_action_authority_exposed: false,
      numeric_utility_priority_probability_feasibility_exposed: false,
      same_turn_feedback_allowed: false,
    },
  });
}
