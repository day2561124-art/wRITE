import { hashAgentRunValue } from "./agent-run-service.mjs";
import {
  goalImplementationIntentionEventSchemaVersion,
  worldSimulationGoalImplementationIntentionVersion,
  projectWorldSimulationEffectiveGoalImplementationIntentions,
} from "./world-simulation-goal-to-plan-implementation-intention-service.mjs";

export const worldSimulationGoalImplementationIntentionRevisionVersion = "phase69b-goal-implementation-intention-revision-v1";
export const goalImplementationIntentionRevisionEventSchemaVersion = "phase69b-goal-implementation-intention-revision-event-v1";
export const goalImplementationIntentionRevisionHistoryReferenceSchemaVersion = "phase69b-goal-implementation-intention-revision-history-ref-v1";
export const effectiveRevisedGoalImplementationIntentionProjectionVersion = "phase69b-effective-revised-goal-implementation-intention-projection-v1";
export const revisedGoalImplementationIntentionCharacterProjectionVersion = "phase69b-bounded-revised-goal-implementation-intention-character-projection-v1";
export const goalImplementationIntentionRevisionMaxCharacterItems = 8;

const supportedOperations = Object.freeze(["support", "challenge", "suspend", "abandon", "revise"]);
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
function boundedString(value, label, maxLength = 180, code = "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_REVISION_INPUT_INVALID") {
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
function revisionEventHash(event) { return hashWithout(event, "revision_event_hash"); }
function phase69AEventHash(event) { return hashWithout(event, "implementation_intention_event_hash"); }

function normalizeDescriptor(raw, kindField, supportedKinds, label) {
  if (!isObject(raw)) {
    const error = new Error(`${label} must be an object.`);
    error.code = "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_REVISION_DESCRIPTOR_INVALID";
    throw error;
  }
  const kind = boundedString(raw[kindField], `${label}.${kindField}`, 80,
    "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_REVISION_DESCRIPTOR_INVALID");
  if (!supportedKinds.includes(kind)) {
    const error = new Error(`Unsupported Phase69B ${kindField} ${kind}.`);
    error.code = "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_REVISION_DESCRIPTOR_INVALID";
    throw error;
  }
  const text = boundedString(raw.label, `${label}.label`, 200,
    "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_REVISION_DESCRIPTOR_INVALID");
  const context = optionalString(raw.context);
  if (context && context.length > 240) {
    const error = new Error(`${label}.context exceeds the Phase69B bound.`);
    error.code = "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_REVISION_DESCRIPTOR_INVALID";
    throw error;
  }
  for (const forbidden of ["action_id", "mutation", "mutation_path", "world_state_patch", "outcome", "utility", "priority", "probability", "feasibility_score", "timestamp_ms"]) {
    if (Object.hasOwn(raw, forbidden)) {
      const error = new Error(`${label} may not contain executable or numeric authority field ${forbidden}.`);
      error.code = "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_REVISION_EXECUTION_AUTHORITY_FORBIDDEN";
      throw error;
    }
  }
  return { [kindField]: kind, label: text, context: context ?? null };
}
function normalizeCue(raw) { return normalizeDescriptor(raw, "cue_kind", supportedCueKinds, "replacement_cue_descriptor"); }
function normalizeResponse(raw) { return normalizeDescriptor(raw, "response_kind", supportedResponseKinds, "replacement_response_descriptor"); }

function validatePhase69AEvent(worldState, eventId) {
  const event = object(object(worldState.goal_implementation_intention_events)[eventId]);
  if (!Object.keys(event).length
      || event.schema_version !== goalImplementationIntentionEventSchemaVersion
      || event.version !== worldSimulationGoalImplementationIntentionVersion
      || event.immutable !== true
      || event.implementation_intention_event_id !== eventId
      || !optionalString(event.implementation_intention_event_hash)
      || !optionalString(event.implementation_intention_id)
      || !optionalString(event.character)
      || !optionalString(event.goal_id)
      || phase69AEventHash(event) !== event.implementation_intention_event_hash) {
    const error = new Error(`Phase69B cannot resolve canonical Phase69A event ${eventId}.`);
    error.code = "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_REVISION_PHASE69A_SOURCE_INVALID";
    throw error;
  }
  return event;
}

function formationEventByPlanId(worldState, character, planId) {
  for (let index = array(worldState.goal_implementation_intention_history).length - 1; index >= 0; index -= 1) {
    const ref = worldState.goal_implementation_intention_history[index];
    if (ref?.implementation_intention_id !== planId || !sameCharacter(ref?.character, character)) continue;
    const event = validatePhase69AEvent(worldState, ref.implementation_intention_event_id);
    if (ref.implementation_intention_event_hash !== event.implementation_intention_event_hash) {
      const error = new Error(`Phase69B target plan ${planId} has non-canonical Phase69A history.`);
      error.code = "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_REVISION_PHASE69A_SOURCE_INVALID";
      throw error;
    }
    return event;
  }
  return null;
}

function revisionEventByReplacementPlanId(worldState, character, planId) {
  for (let index = array(worldState.goal_implementation_intention_revision_history).length - 1; index >= 0; index -= 1) {
    const ref = worldState.goal_implementation_intention_revision_history[index];
    if (ref?.replacement_implementation_intention_id !== planId || !sameCharacter(ref?.character, character)) continue;
    const event = validatePersistedRevisionEvent(
      object(worldState.goal_implementation_intention_revision_events)[ref.revision_event_id],
      ref.revision_event_id,
    );
    if (ref.revision_event_hash !== event.revision_event_hash
        || event.operation !== "revise"
        || event.replacement_implementation_intention_id !== planId) {
      const error = new Error(`Phase69B replacement plan ${planId} has non-canonical revision provenance.`);
      error.code = "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_REVISION_TARGET_SOURCE_INVALID";
      throw error;
    }
    return event;
  }
  return null;
}

function canonicalTargetSource(worldState, character, planId) {
  const formation = formationEventByPlanId(worldState, character, planId);
  if (formation) {
    return {
      target_source_kind: "phase69a_goal_implementation_intention_event",
      target_source_event_id: formation.implementation_intention_event_id,
      target_source_event_hash: formation.implementation_intention_event_hash,
    };
  }
  const revision = revisionEventByReplacementPlanId(worldState, character, planId);
  if (revision) {
    return {
      target_source_kind: "phase69b_goal_implementation_intention_revision_event",
      target_source_event_id: revision.revision_event_id,
      target_source_event_hash: revision.revision_event_hash,
    };
  }
  const error = new Error(`Phase69B target plan ${planId} has no canonical formation or replacement provenance.`);
  error.code = "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_REVISION_TARGET_SOURCE_INVALID";
  throw error;
}

function findCharacterPlans(recordsByCharacter, character) {
  for (const [name, records] of Object.entries(recordsByCharacter ?? {})) {
    if (sameCharacter(name, character)) return object(records);
  }
  return {};
}

function validatePersistedRevisionEvent(event, eventId) {
  if (!isObject(event)
      || event.schema_version !== goalImplementationIntentionRevisionEventSchemaVersion
      || event.version !== worldSimulationGoalImplementationIntentionRevisionVersion
      || event.immutable !== true
      || event.revision_event_id !== eventId
      || !optionalString(event.revision_event_hash)
      || !optionalString(event.character)
      || !optionalString(event.source_turn_id)
      || !supportedOperations.includes(event.operation)
      || !optionalString(event.target_implementation_intention_id)
      || !["phase69a_goal_implementation_intention_event", "phase69b_goal_implementation_intention_revision_event"].includes(event.target_source_kind)
      || !optionalString(event.target_source_event_id)
      || !optionalString(event.target_source_event_hash)
      || !optionalString(event.goal_id)
      || !optionalString(event.resolver_view_hash)
      || event.subjective_plan_reconsideration !== true
      || event.world_truth_verified !== false
      || event.execution_failure_verified !== false
      || event.selected_action_authority !== false
      || event.executable_action_id !== null
      || event.utility_score !== null
      || event.priority_score !== null
      || event.success_probability !== null
      || event.feasibility_score !== null
      || event.character_brain_direct_write !== false
      || event.status !== "goal_implementation_intention_revision_recorded") {
    const error = new Error(`GoalImplementationIntentionRevisionEvent ${eventId} is invalid.`);
    error.code = "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_REVISION_EVENT_INVALID";
    throw error;
  }
  if (event.operation === "revise") {
    if (!optionalString(event.replacement_implementation_intention_id)
        || !isObject(event.replacement_cue_descriptor)
        || !isObject(event.replacement_response_descriptor)) {
      const error = new Error(`Phase69B revise event ${eventId} lacks a replacement plan.`);
      error.code = "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_REVISION_REPLACEMENT_INVALID";
      throw error;
    }
    normalizeCue(event.replacement_cue_descriptor);
    normalizeResponse(event.replacement_response_descriptor);
  } else if (event.replacement_implementation_intention_id !== null
      || event.replacement_cue_descriptor !== null
      || event.replacement_response_descriptor !== null) {
    const error = new Error(`${event.operation} may not create a replacement implementation intention.`);
    error.code = "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_REVISION_REPLACEMENT_FORBIDDEN";
    throw error;
  }
  if (revisionEventHash(event) !== event.revision_event_hash) {
    const error = new Error(`GoalImplementationIntentionRevisionEvent ${eventId} failed hash verification.`);
    error.code = "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_REVISION_EVENT_HASH_MISMATCH";
    throw error;
  }
  return event;
}

function validateRevisionHistory(worldState) {
  if (Object.hasOwn(worldState, "goal_implementation_intention_revision_events")
      && !isObject(worldState.goal_implementation_intention_revision_events)) {
    const error = new Error("goal_implementation_intention_revision_events must be an object.");
    error.code = "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_REVISION_EVENT_STORE_INVALID";
    throw error;
  }
  if (Object.hasOwn(worldState, "goal_implementation_intention_revision_history")
      && !Array.isArray(worldState.goal_implementation_intention_revision_history)) {
    const error = new Error("goal_implementation_intention_revision_history must be an array.");
    error.code = "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_REVISION_HISTORY_INVALID";
    throw error;
  }
  const events = object(worldState.goal_implementation_intention_revision_events);
  const history = array(worldState.goal_implementation_intention_revision_history);
  const latestByCharacter = new Map();
  const seenEventIds = new Set();
  const seenReplacementIds = new Set();
  for (const [index, ref] of history.entries()) {
    if (!isObject(ref)
        || ref.schema_version !== goalImplementationIntentionRevisionHistoryReferenceSchemaVersion
        || ref.derived_index !== true
        || !optionalString(ref.revision_event_id)
        || !optionalString(ref.revision_event_hash)
        || !optionalString(ref.character)
        || !optionalString(ref.source_turn_id)
        || !supportedOperations.includes(ref.operation)
        || !optionalString(ref.target_implementation_intention_id)
        || !optionalString(ref.goal_id)
        || ref.status !== "goal_implementation_intention_revision_recorded") {
      const error = new Error(`goal_implementation_intention_revision_history[${index}] is invalid.`);
      error.code = "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_REVISION_HISTORY_REFERENCE_INVALID";
      throw error;
    }
    if (seenEventIds.has(ref.revision_event_id)) {
      const error = new Error(`Duplicate Phase69B revision event ${ref.revision_event_id}.`);
      error.code = "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_REVISION_IDENTITY_REUSE_FORBIDDEN";
      throw error;
    }
    const event = validatePersistedRevisionEvent(events[ref.revision_event_id], ref.revision_event_id);
    const targetSource = canonicalTargetSource(
      worldState,
      event.character,
      event.target_implementation_intention_id,
    );
    if (event.target_source_kind !== targetSource.target_source_kind
        || event.target_source_event_id !== targetSource.target_source_event_id
        || event.target_source_event_hash !== targetSource.target_source_event_hash) {
      const error = new Error(`Phase69B revision event ${event.revision_event_id} does not pin canonical target-plan provenance.`);
      error.code = "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_REVISION_TARGET_SOURCE_INVALID";
      throw error;
    }
    const key = characterKey(event.character);
    const previous = latestByCharacter.get(key) ?? null;
    if (ref.revision_event_hash !== event.revision_event_hash
        || ref.character !== event.character
        || ref.source_turn_id !== event.source_turn_id
        || ref.operation !== event.operation
        || ref.target_implementation_intention_id !== event.target_implementation_intention_id
        || ref.goal_id !== event.goal_id
        || ref.replacement_implementation_intention_id !== event.replacement_implementation_intention_id
        || ref.previous_revision_event_id !== event.previous_revision_event_id
        || ref.previous_revision_event_hash !== event.previous_revision_event_hash
        || event.previous_revision_event_id !== (previous?.revision_event_id ?? null)
        || event.previous_revision_event_hash !== (previous?.revision_event_hash ?? null)) {
      const error = new Error(`Phase69B history reference ${ref.revision_event_id} breaks its per-character chain.`);
      error.code = "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_REVISION_HISTORY_REFERENCE_MISMATCH";
      throw error;
    }
    if (event.replacement_implementation_intention_id) {
      if (seenReplacementIds.has(event.replacement_implementation_intention_id)) {
        const error = new Error(`Phase69B replacement plan identity ${event.replacement_implementation_intention_id} was reused.`);
        error.code = "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_REVISION_IDENTITY_REUSE_FORBIDDEN";
        throw error;
      }
      seenReplacementIds.add(event.replacement_implementation_intention_id);
    }
    seenEventIds.add(event.revision_event_id);
    latestByCharacter.set(key, event);
  }
  return { events, history, latestByCharacter, seenReplacementIds };
}

export function projectWorldSimulationEffectiveRevisedGoalImplementationIntentions(input = {}) {
  const worldState = cloneJson(object(input.world_state));
  const base = projectWorldSimulationEffectiveGoalImplementationIntentions({ world_state: worldState });
  const revision = validateRevisionHistory(worldState);
  const plansByCharacter = cloneJson(base.plans_by_character);
  for (const records of Object.values(plansByCharacter)) {
    for (const record of Object.values(object(records))) {
      record.source_goal_committed = record.state === "active";
      record.reconsideration_state = "active";
      record.support_event_ids = [];
      record.challenge_event_ids = [];
      record.latest_revision_event_id = null;
      record.superseded_by_revision_event_id = null;
      record.replacement_implementation_intention_id = null;
    }
  }
  revision.history.forEach((ref, historyIndex) => {
    const event = revision.events[ref.revision_event_id];
    plansByCharacter[event.character] ??= {};
    const records = plansByCharacter[event.character];
    const target = records[event.target_implementation_intention_id];
    if (!target) {
      const error = new Error(`Phase69B target plan ${event.target_implementation_intention_id} does not exist during replay.`);
      error.code = "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_REVISION_TARGET_INVALID";
      throw error;
    }
    const state = target.reconsideration_state;
    if (event.operation === "support") {
      if (!["active", "challenged"].includes(state)) throwRevisionTransition(event, state);
      target.support_event_ids.push(event.revision_event_id);
    } else if (event.operation === "challenge") {
      if (!["active", "challenged"].includes(state)) throwRevisionTransition(event, state);
      target.challenge_event_ids.push(event.revision_event_id);
      target.reconsideration_state = "challenged";
    } else if (event.operation === "suspend") {
      if (!["active", "challenged"].includes(state)) throwRevisionTransition(event, state);
      target.reconsideration_state = "suspended";
    } else if (event.operation === "abandon") {
      if (!["active", "challenged", "suspended"].includes(state)) throwRevisionTransition(event, state);
      target.reconsideration_state = "abandoned";
    } else if (event.operation === "revise") {
      if (!["active", "challenged", "suspended"].includes(state)) throwRevisionTransition(event, state);
      if (records[event.replacement_implementation_intention_id]) {
        const error = new Error(`Phase69B replacement plan ${event.replacement_implementation_intention_id} already exists.`);
        error.code = "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_REVISION_IDENTITY_REUSE_FORBIDDEN";
        throw error;
      }
      target.reconsideration_state = "superseded";
      target.superseded_by_revision_event_id = event.revision_event_id;
      target.replacement_implementation_intention_id = event.replacement_implementation_intention_id;
      records[event.replacement_implementation_intention_id] = {
        implementation_intention_id: event.replacement_implementation_intention_id,
        character: event.character,
        goal_id: event.goal_id,
        cue_descriptor: cloneJson(event.replacement_cue_descriptor),
        response_descriptor: cloneJson(event.replacement_response_descriptor),
        state: "active",
        reconsideration_state: "active",
        source_goal_committed: target.source_goal_committed === true,
        latest_history_index: Number(base.replayed_event_count) + historyIndex,
        support_event_ids: [],
        challenge_event_ids: [],
        latest_revision_event_id: event.revision_event_id,
        superseded_by_revision_event_id: null,
        replacement_implementation_intention_id: null,
        subjective_prospective_plan: true,
        selected_action_authority: false,
        established_by_revision_event_id: event.revision_event_id,
      };
    }
    target.latest_revision_event_id = event.revision_event_id;
  });
  for (const records of Object.values(plansByCharacter)) {
    for (const record of Object.values(object(records))) {
      if (["superseded", "abandoned"].includes(record.reconsideration_state)) {
        record.state = record.reconsideration_state;
      } else if (record.source_goal_committed !== true) {
        record.state = "inactive_source_goal_not_committed";
      } else {
        record.state = record.reconsideration_state;
      }
    }
  }
  const projection = {
    version: effectiveRevisedGoalImplementationIntentionProjectionVersion,
    source_formation_version: worldSimulationGoalImplementationIntentionVersion,
    source_revision_version: worldSimulationGoalImplementationIntentionRevisionVersion,
    plans_by_character: plansByCharacter,
    formation_history_hash: base.source_history_hash,
    revision_history_hash: hashAgentRunValue(revision.history),
    replayed_formation_event_count: base.replayed_event_count,
    replayed_revision_event_count: revision.history.length,
    replayable_projection: true,
    explicit_revision_only: true,
    support_preserves_nonterminal_state: true,
    challenge_is_not_abandonment: true,
    suspend_is_not_goal_suspension: true,
    revise_explicitly_supersedes_target: true,
    last_write_wins_applied: false,
    action_selection_authority_claimed: false,
    execution_failure_or_feasibility_authority_claimed: false,
    numeric_utility_priority_probability_feasibility_modeled: false,
    world_truth_authority_claimed: false,
  };
  projection.projection_hash = hashAgentRunValue(projection);
  return deepFreeze(projection);
}

function throwRevisionTransition(event, state) {
  const error = new Error(`Illegal Phase69B ${event.operation} transition for ${event.target_implementation_intention_id} from ${state}.`);
  error.code = "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_REVISION_STATE_TRANSITION_INVALID";
  throw error;
}

export function buildWorldSimulationGoalImplementationIntentionRevisionResolverView(input = {}) {
  const worldState = cloneJson(object(input.world_state));
  const turnId = boundedString(input.turn_id, "turn_id", 240);
  const effective = projectWorldSimulationEffectiveRevisedGoalImplementationIntentions({ world_state: worldState });
  const plans = [];
  for (const [character, records] of Object.entries(effective.plans_by_character ?? {})) {
    for (const record of Object.values(object(records))) {
      const sourceEvent = record.established_by_revision_event_id
        ? null
        : formationEventByPlanId(worldState, character, record.implementation_intention_id);
      plans.push({
        character,
        implementation_intention_id: record.implementation_intention_id,
        goal_id: record.goal_id,
        state: record.state,
        cue_descriptor: cloneJson(record.cue_descriptor),
        response_descriptor: cloneJson(record.response_descriptor),
        source_formation_event_id: sourceEvent?.implementation_intention_event_id ?? null,
        source_formation_event_hash: sourceEvent?.implementation_intention_event_hash ?? null,
      });
    }
  }
  const view = {
    version: worldSimulationGoalImplementationIntentionRevisionVersion,
    turn_id: turnId,
    effective_implementation_intentions: plans,
    supported_operations: [...supportedOperations],
    supported_cue_kinds: [...supportedCueKinds],
    supported_response_kinds: [...supportedResponseKinds],
    explicit_target_required: true,
    same_character_target_required: true,
    raw_world_state_exposed: false,
    raw_world_event_exposed: false,
    raw_memory_content_exposed: false,
    hidden_retrieval_graph_exposed: false,
    action_ids_exposed: false,
    mutation_authority_exposed: false,
    execution_failure_judgment_requested: false,
    feasibility_judgment_requested: false,
    numeric_utility_priority_probability_requested: false,
  };
  view.resolver_view_hash = hashAgentRunValue(view);
  return deepFreeze(view);
}

function normalizeDecision(raw, resolverView, effectiveProjection, worldState) {
  if (!isObject(raw)) {
    const error = new Error("Phase69B revision decision must be an object.");
    error.code = "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_REVISION_DECISION_INVALID";
    throw error;
  }
  const character = boundedString(raw.character, "decision.character", 240,
    "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_REVISION_DECISION_INVALID");
  const operation = boundedString(raw.operation, "decision.operation", 80,
    "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_REVISION_DECISION_INVALID");
  if (!supportedOperations.includes(operation)) {
    const error = new Error(`Unsupported Phase69B operation ${operation}.`);
    error.code = "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_REVISION_OPERATION_UNSUPPORTED";
    throw error;
  }
  const resolverViewHash = boundedString(raw.resolver_view_hash ?? resolverView.resolver_view_hash,
    "resolver_view_hash", 128, "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_REVISION_RESOLVER_VIEW_HASH_REQUIRED");
  if (resolverViewHash !== resolverView.resolver_view_hash) {
    const error = new Error("Phase69B decision does not pin the canonical resolver view.");
    error.code = "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_REVISION_RESOLVER_VIEW_HASH_MISMATCH";
    throw error;
  }
  const targetId = boundedString(raw.target_implementation_intention_id, "target_implementation_intention_id", 240,
    "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_REVISION_TARGET_INVALID");
  const records = findCharacterPlans(effectiveProjection.plans_by_character, character);
  const target = records[targetId];
  if (!target) {
    const error = new Error(`Phase69B target ${targetId} is not a same-character implementation intention.`);
    error.code = "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_REVISION_TARGET_INVALID";
    throw error;
  }
  const state = target.reconsideration_state ?? target.state;
  if ((["support", "challenge", "suspend"].includes(operation) && !["active", "challenged"].includes(state))
      || (operation === "abandon" && !["active", "challenged", "suspended"].includes(state))
      || (operation === "revise" && !["active", "challenged", "suspended"].includes(state))) {
    const error = new Error(`Illegal Phase69B ${operation} transition from ${state}.`);
    error.code = "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_REVISION_STATE_TRANSITION_INVALID";
    throw error;
  }
  const targetSource = canonicalTargetSource(worldState, character, targetId);
  let replacementId = null;
  let replacementCue = null;
  let replacementResponse = null;
  if (operation === "revise") {
    replacementCue = normalizeCue(raw.replacement_cue_descriptor);
    replacementResponse = normalizeResponse(raw.replacement_response_descriptor);
    replacementId = `goal_implementation_intention_${hashAgentRunValue({
      version: worldSimulationGoalImplementationIntentionRevisionVersion,
      character: characterKey(character),
      goal_id: target.goal_id,
      cue_descriptor: replacementCue,
      response_descriptor: replacementResponse,
      supersedes: targetId,
    }).slice(0, 24)}`;
    if (records[replacementId]) {
      const error = new Error(`Phase69B replacement implementation intention ${replacementId} already exists.`);
      error.code = "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_REVISION_IDENTITY_REUSE_FORBIDDEN";
      throw error;
    }
  } else if (raw.replacement_cue_descriptor != null || raw.replacement_response_descriptor != null) {
    const error = new Error(`${operation} may not define replacement descriptors.`);
    error.code = "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_REVISION_REPLACEMENT_FORBIDDEN";
    throw error;
  }
  return {
    character,
    operation,
    target_implementation_intention_id: targetId,
    target_source_kind: targetSource.target_source_kind,
    target_source_event_id: targetSource.target_source_event_id,
    target_source_event_hash: targetSource.target_source_event_hash,
    goal_id: target.goal_id,
    replacement_implementation_intention_id: replacementId,
    replacement_cue_descriptor: replacementCue,
    replacement_response_descriptor: replacementResponse,
    resolver_view_hash: resolverViewHash,
    reason: optionalString(raw.reason) ?? `explicit_programmatic_plan_${operation}`,
    source: optionalString(raw.source) ?? "programmatic_goal_implementation_intention_revision_resolver",
  };
}

function revisionEventFor(decision, previous, turnId) {
  const base = {
    schema_version: goalImplementationIntentionRevisionEventSchemaVersion,
    version: worldSimulationGoalImplementationIntentionRevisionVersion,
    immutable: true,
    character: decision.character,
    source_turn_id: turnId,
    operation: decision.operation,
    target_implementation_intention_id: decision.target_implementation_intention_id,
    target_source_kind: decision.target_source_kind,
    target_source_event_id: decision.target_source_event_id,
    target_source_event_hash: decision.target_source_event_hash,
    goal_id: decision.goal_id,
    replacement_implementation_intention_id: decision.replacement_implementation_intention_id,
    replacement_cue_descriptor: cloneJson(decision.replacement_cue_descriptor),
    replacement_response_descriptor: cloneJson(decision.replacement_response_descriptor),
    resolver_view_hash: decision.resolver_view_hash,
    previous_revision_event_id: previous?.revision_event_id ?? null,
    previous_revision_event_hash: previous?.revision_event_hash ?? null,
    revision_evidence: {
      decision_source: decision.source,
      decision_reason: decision.reason,
      explicit_target_required: true,
      same_character_target_required: true,
      execution_failure_verified: false,
      feasibility_verified: false,
      revise_explicitly_supersedes_target: true,
      last_write_wins_applied: false,
    },
    subjective_plan_reconsideration: true,
    world_truth_verified: false,
    execution_failure_verified: false,
    selected_action_authority: false,
    executable_action_id: null,
    utility_score: null,
    priority_score: null,
    success_probability: null,
    feasibility_score: null,
    character_brain_direct_write: false,
    status: "goal_implementation_intention_revision_recorded",
  };
  const eventId = `goal_implementation_intention_revision_event_${hashAgentRunValue({
    version: worldSimulationGoalImplementationIntentionRevisionVersion,
    character: characterKey(decision.character),
    source_turn_id: turnId,
    operation: decision.operation,
    target_implementation_intention_id: decision.target_implementation_intention_id,
    replacement_implementation_intention_id: decision.replacement_implementation_intention_id,
    previous_revision_event_hash: previous?.revision_event_hash ?? null,
  }).slice(0, 24)}`;
  const event = { ...base, revision_event_id: eventId };
  event.revision_event_hash = revisionEventHash(event);
  return deepFreeze(event);
}

function historyReferenceFor(event) {
  return deepFreeze({
    schema_version: goalImplementationIntentionRevisionHistoryReferenceSchemaVersion,
    derived_index: true,
    revision_event_id: event.revision_event_id,
    revision_event_hash: event.revision_event_hash,
    character: event.character,
    source_turn_id: event.source_turn_id,
    operation: event.operation,
    target_implementation_intention_id: event.target_implementation_intention_id,
    goal_id: event.goal_id,
    replacement_implementation_intention_id: event.replacement_implementation_intention_id,
    previous_revision_event_id: event.previous_revision_event_id,
    previous_revision_event_hash: event.previous_revision_event_hash,
    status: event.status,
  });
}

export function buildWorldSimulationGoalImplementationIntentionRevisionContract() {
  return deepFreeze({
    version: worldSimulationGoalImplementationIntentionRevisionVersion,
    phase: "Phase69B",
    status: "implementation_intention_revision_installed",
    supported_operations: [...supportedOperations],
    immutable_revision_event_write_once_required: true,
    append_only_revision_history_required: true,
    per_character_previous_event_hash_chain_required: true,
    explicit_target_required: true,
    same_character_target_required: true,
    support_preserves_nonterminal_state: true,
    challenge_is_not_abandonment: true,
    suspend_is_not_goal_suspension: true,
    abandon_is_terminal_for_plan_identity: true,
    revise_explicitly_supersedes_target: true,
    replacement_receives_new_deterministic_identity: true,
    multiple_nonterminal_plans_per_goal_allowed: true,
    last_write_wins_allowed: false,
    execution_failure_monitoring_modeled: false,
    objective_feasibility_modeled: false,
    numeric_utility_priority_probability_feasibility_modeled: false,
    action_selection_authority_claimed: false,
    world_truth_authority_claimed: false,
    separate_retrieval_engine_installed: false,
    hidden_semantic_graph_allowed: false,
    character_brain_direct_durable_write_allowed: false,
    authoritative_mutation_owner: "phase62k-authoritative-mutation-executor-v1",
    deterministic_replay_required: true,
    input_immutability_required: true,
  });
}

export function buildWorldSimulationGoalImplementationIntentionRevisions(input = {}) {
  const worldState = cloneJson(object(input.world_state));
  const turnId = boundedString(input.turn_id, "turn_id", 240);
  const rawDecisions = array(input.revision_decisions);
  const inputSnapshot = cloneJson({ world_state: worldState, turn_id: turnId, revision_decisions: rawDecisions });
  const inputHash = hashAgentRunValue(inputSnapshot);
  const existing = validateRevisionHistory(worldState);
  const effective = projectWorldSimulationEffectiveRevisedGoalImplementationIntentions({ world_state: worldState });
  const resolverView = buildWorldSimulationGoalImplementationIntentionRevisionResolverView({ world_state: worldState, turn_id: turnId });
  const decisions = rawDecisions.map((decision) => normalizeDecision(decision, resolverView, effective, worldState));
  const existingTurnTargetKeys = new Set(existing.history
    .map((ref) => existing.events[ref.revision_event_id])
    .filter((event) => event?.source_turn_id === turnId)
    .map((event) => `${characterKey(event.character)}\u0000${event.target_implementation_intention_id}`));
  const seenTurnTargetKeys = new Set();
  for (const decision of decisions) {
    const key = `${characterKey(decision.character)}\u0000${decision.target_implementation_intention_id}`;
    if (existingTurnTargetKeys.has(key) || seenTurnTargetKeys.has(key)) {
      const error = new Error(`Phase69B allows at most one durable transition per character/target plan per turn.`);
      error.code = "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_REVISION_PER_TARGET_TURN_LIMIT";
      throw error;
    }
    seenTurnTargetKeys.add(key);
  }
  const preview = cloneJson(worldState);
  const latestByCharacter = new Map(existing.latestByCharacter);
  const createdEvents = [];
  const appendedReferences = [];
  const stateTransitions = [];
  for (const decision of decisions) {
    const key = characterKey(decision.character);
    const event = revisionEventFor(decision, latestByCharacter.get(key) ?? null, turnId);
    preview.goal_implementation_intention_revision_events = object(preview.goal_implementation_intention_revision_events);
    if (preview.goal_implementation_intention_revision_events[event.revision_event_id]) {
      const error = new Error(`Phase69B revision event ${event.revision_event_id} already exists.`);
      error.code = "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_REVISION_EVENT_IMMUTABILITY_VIOLATION";
      throw error;
    }
    preview.goal_implementation_intention_revision_events[event.revision_event_id] = cloneJson(event);
    const ref = historyReferenceFor(event);
    createdEvents.push(event);
    appendedReferences.push(ref);
    latestByCharacter.set(key, event);
    stateTransitions.push({
      entity: "world",
      field: `goal_implementation_intention_revision_events.${event.revision_event_id}`,
      from: null,
      to: cloneJson(event),
      cause: `persist immutable GoalImplementationIntentionRevisionEvent ${event.revision_event_id}`,
      source_layer: "goal_implementation_intention_revision",
    });
  }
  if (appendedReferences.length) {
    const nextHistory = [...existing.history.map(cloneJson), ...appendedReferences.map(cloneJson)];
    preview.goal_implementation_intention_revision_history = nextHistory;
    stateTransitions.push({
      entity: "world",
      field: "goal_implementation_intention_revision_history",
      from: cloneJson(worldState.goal_implementation_intention_revision_history ?? null),
      to: cloneJson(nextHistory),
      cause: `append ${appendedReferences.length} Phase69B implementation-intention revision history reference(s)`,
      source_layer: "goal_implementation_intention_revision",
    });
  }
  const effectiveProjection = projectWorldSimulationEffectiveRevisedGoalImplementationIntentions({ world_state: preview });
  if (hashAgentRunValue(inputSnapshot) !== inputHash) {
    const error = new Error("Phase69B implementation-intention revision mutated its input snapshot.");
    error.code = "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_REVISION_INPUT_MUTATED";
    throw error;
  }
  return deepFreeze({
    ok: true,
    version: worldSimulationGoalImplementationIntentionRevisionVersion,
    result: {
      revision_decision_count: decisions.length,
      revision_events_created: createdEvents,
      history_references_appended: appendedReferences,
      state_transitions: stateTransitions,
      preview_world_state: preview,
      resolver_view_hash: resolverView.resolver_view_hash,
      effective_revised_goal_implementation_intention_projection: effectiveProjection,
      audit: {
        input_context_hash: inputHash,
        explicit_target_required: true,
        same_character_target_required: true,
        support_preserves_nonterminal_state: true,
        challenge_is_not_abandonment: true,
        suspend_is_not_goal_suspension: true,
        revise_explicitly_supersedes_target: true,
        last_write_wins_applied: false,
        execution_failure_monitoring_modeled: false,
        objective_feasibility_modeled: false,
        numeric_utility_priority_probability_feasibility_modeled: false,
        action_selection_authority_claimed: false,
        world_truth_authority_claimed: false,
      },
    },
  });
}

function assertNoSameTurnWrites(worldState, character, currentTurnId) {
  for (const ref of array(worldState.goal_implementation_intention_revision_history)) {
    if (sameCharacter(ref?.character, character) && ref?.source_turn_id === currentTurnId) {
      const error = new Error(`Phase69B cannot expose revised plan state after same-turn write for ${character}.`);
      error.code = "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_REVISION_SAME_TURN_CONTAMINATION";
      throw error;
    }
  }
}

export function projectWorldSimulationRevisedGoalImplementationIntentionsForCharacter(input = {}) {
  const worldState = cloneJson(object(input.world_state));
  const character = boundedString(input.character, "character", 240);
  const currentTurnId = boundedString(input.current_turn_id, "current_turn_id", 240);
  const inputHash = hashAgentRunValue(worldState);
  assertNoSameTurnWrites(worldState, character, currentTurnId);
  const effective = projectWorldSimulationEffectiveRevisedGoalImplementationIntentions({ world_state: worldState });
  const records = Object.values(findCharacterPlans(effective.plans_by_character, character))
    .filter((record) => ["active", "challenged"].includes(record.state))
    .sort((left, right) => Number(right.latest_history_index) - Number(left.latest_history_index)
      || compareText(left.implementation_intention_id, right.implementation_intention_id));
  const selected = records.slice(0, goalImplementationIntentionRevisionMaxCharacterItems);
  const plans = selected.map((record) => ({
    if_cue: cloneJson(record.cue_descriptor),
    then_response: cloneJson(record.response_descriptor),
    reconsideration_state: record.state,
    subjective_prospective_plan: true,
    selected_action_authority: false,
  }));
  const characterView = {
    source: "committed_prior_turn_effective_revised_goal_implementation_intentions",
    implementation_intentions: plans,
    implementation_intentions_truncated: selected.length < records.length,
    engine_ids_hashes_exposed: false,
    executable_action_ids_exposed: false,
    execution_failure_or_feasibility_authority_exposed: false,
    numeric_utility_priority_probability_feasibility_exposed: false,
  };
  if (hashAgentRunValue(worldState) !== inputHash) {
    const error = new Error("Phase69B bounded plan projection mutated its input.");
    error.code = "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_REVISION_INPUT_MUTATED";
    throw error;
  }
  return deepFreeze({
    ok: true,
    version: revisedGoalImplementationIntentionCharacterProjectionVersion,
    source_projection_version: effectiveRevisedGoalImplementationIntentionProjectionVersion,
    character,
    current_turn_id: currentTurnId,
    character_view: characterView,
    character_view_hash: hashAgentRunValue(characterView),
    audit: {
      source_projection_hash: effective.projection_hash,
      source_plan_count: records.length,
      projected_plan_count: selected.length,
      plan_ids_exposed: false,
      revision_event_ids_exposed: false,
      source_event_ids_hashes_exposed: false,
      world_truth_authority_exposed: false,
      action_selection_authority_exposed: false,
      execution_failure_or_feasibility_authority_exposed: false,
      numeric_utility_priority_probability_feasibility_exposed: false,
      same_turn_feedback_allowed: false,
    },
  });
}
