import { hashAgentRunValue } from "./agent-run-service.mjs";
import { projectWorldSimulationEffectiveSubjectiveBeliefs } from "./world-simulation-effective-subjective-belief-projection-service.mjs";
import { projectWorldSimulationEffectiveAutobiographicalSelfInterpretations } from "./world-simulation-autobiographical-self-interpretation-service.mjs";
import { projectWorldSimulationEffectiveRevisedStructuredSelfModel } from "./world-simulation-structured-self-model-revision-service.mjs";

export const worldSimulationMotivationGoalIntegrationVersion = "phase68d-motivation-goal-integration-v1";
export const motivationalGoalEventSchemaVersion = "phase68d-motivational-goal-event-v1";
export const motivationalGoalHistoryReferenceSchemaVersion = "phase68d-motivational-goal-history-ref-v1";
export const effectiveMotivationalGoalProjectionVersion = "phase68d-effective-motivational-goal-projection-v1";
export const motivationalGoalCharacterProjectionVersion = "phase68d-bounded-motivational-goal-character-projection-v1";
export const motivationalGoalMaxCharacterItems = 8;

const supportedOperations = Object.freeze(["propose", "commit", "suspend", "abandon"]);
const supportedGoalKinds = Object.freeze(["achieve_state", "maintain_state", "avoid_state", "restore_state"]);
const supportedRelations = Object.freeze(["self_concordant_with", "supports", "conflicts_with", "externally_prompted_by"]);

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
function boundedString(value, label, maxLength = 160, code = "WORLD_SIMULATION_MOTIVATIONAL_GOAL_INPUT_INVALID") {
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
function goalEventHash(event) { return hashWithout(event, "goal_event_hash"); }
function sourceRefKey(ref) { return [ref?.source_kind, ref?.source_event_id, ref?.source_event_hash].join("\u0000"); }

function normalizeTargetDescriptor(raw) {
  if (!isObject(raw)) {
    const error = new Error("target_descriptor must be an object.");
    error.code = "WORLD_SIMULATION_MOTIVATIONAL_GOAL_DESCRIPTOR_INVALID";
    throw error;
  }
  const label = boundedString(raw.label, "target_descriptor.label", 180, "WORLD_SIMULATION_MOTIVATIONAL_GOAL_DESCRIPTOR_INVALID");
  const context = optionalString(raw.context);
  if (context && context.length > 240) {
    const error = new Error("target_descriptor.context exceeds the Phase68D bound.");
    error.code = "WORLD_SIMULATION_MOTIVATIONAL_GOAL_DESCRIPTOR_INVALID";
    throw error;
  }
  return { label, context: context ?? null };
}
function normalizeRelations(values) {
  const result = [...new Set(array(values).map(optionalString).filter(Boolean))].sort(compareText);
  if (result.length > 4 || result.some((value) => !supportedRelations.includes(value))) {
    const error = new Error("motivation_relations exceeds the bounded Phase68D relation vocabulary.");
    error.code = "WORLD_SIMULATION_MOTIVATIONAL_GOAL_RELATION_INVALID";
    throw error;
  }
  return result;
}

function canonicalMotivationSources(worldState) {
  const result = [];
  const interpretations = projectWorldSimulationEffectiveAutobiographicalSelfInterpretations({ world_state: worldState });
  for (const [character, records] of Object.entries(interpretations.interpretations_by_character ?? {})) {
    for (const record of Object.values(object(records))) {
      if (record.state !== "active") continue;
      const sourceEvent = object(object(worldState.autobiographical_self_interpretation_events)[record.established_by_interpretation_event_id]);
      if (!optionalString(sourceEvent.interpretation_event_hash)) continue;
      result.push({
        source_kind: "phase68a_autobiographical_self_interpretation_event",
        source_event_id: sourceEvent.interpretation_event_id,
        source_event_hash: sourceEvent.interpretation_event_hash,
        character,
        character_view: {
          interpretation_kind: record.interpretation_kind,
          qualifiers: cloneJson(record.qualifiers),
          subjective_not_world_truth: true,
        },
      });
    }
  }
  const selfModel = projectWorldSimulationEffectiveRevisedStructuredSelfModel({ world_state: worldState });
  for (const [character, records] of Object.entries(selfModel.aspects_by_character ?? {})) {
    for (const record of Object.values(object(records))) {
      if (record.state !== "active") continue;
      const sourceEvent = record.established_by_revision_event_id
        ? object(object(worldState.structured_self_model_revision_events)[record.established_by_revision_event_id])
        : object(object(worldState.structured_self_model_aspect_events)[record.established_by_aspect_event_id]);
      const sourceEventId = record.established_by_revision_event_id
        ? sourceEvent.revision_event_id
        : sourceEvent.aspect_event_id;
      const sourceEventHash = record.established_by_revision_event_id
        ? sourceEvent.revision_event_hash
        : sourceEvent.aspect_event_hash;
      if (!optionalString(sourceEventId) || !optionalString(sourceEventHash)) continue;
      result.push({
        source_kind: record.established_by_revision_event_id
          ? "phase68c_structured_self_model_revision_event"
          : "phase68b_structured_self_model_aspect_event",
        source_event_id: sourceEventId,
        source_event_hash: sourceEventHash,
        character,
        character_view: {
          aspect_type: record.aspect_type,
          domain: record.descriptor?.domain,
          relation: record.descriptor?.relation,
          object: record.descriptor?.object_ref,
          qualifiers: cloneJson(record.descriptor?.qualifiers ?? []),
          subjective_not_world_truth: true,
        },
      });
    }
  }
  const characters = new Set(result.map((item) => item.character));
  for (const character of characters) {
    try {
      const beliefs = projectWorldSimulationEffectiveSubjectiveBeliefs({ world_state: worldState, character });
      for (const belief of array(beliefs.projection?.active_beliefs)) {
        const claimId = optionalString(belief.claim_event_id ?? belief.claim_id);
        if (!claimId) continue;
        const revisionEventId = optionalString(belief.latest_revision_event_id);
        const revisionEventHash = optionalString(belief.latest_revision_event_hash);
        if (!revisionEventId || !revisionEventHash) continue;
        result.push({
          source_kind: "phase66_subjective_belief_revision_event",
          source_event_id: revisionEventId,
          source_event_hash: revisionEventHash,
          character,
          character_view: {
            claim_type: optionalString(belief.claim_type) ?? "subjective_belief",
            subjective_not_world_truth: true,
          },
        });
      }
    } catch {
      // A character can have self-state without Phase66 belief history. Absence is not an error here.
    }
  }
  return result.sort((left, right) => characterKey(left.character).localeCompare(characterKey(right.character))
    || compareText(sourceRefKey(left), sourceRefKey(right)));
}

function validatePersistedGoalEvent(event, eventId) {
  if (!isObject(event)
      || event.schema_version !== motivationalGoalEventSchemaVersion
      || event.version !== worldSimulationMotivationGoalIntegrationVersion
      || event.immutable !== true
      || event.goal_event_id !== eventId
      || !optionalString(event.goal_event_hash)
      || !optionalString(event.goal_id)
      || !optionalString(event.character)
      || !optionalString(event.source_turn_id)
      || !supportedOperations.includes(event.operation)
      || !supportedGoalKinds.includes(event.goal_kind)
      || !optionalString(event.domain)
      || !isObject(event.target_descriptor)
      || !Array.isArray(event.motivation_basis_refs)
      || !Array.isArray(event.motivation_relations)
      || !optionalString(event.resolver_view_hash)
      || event.subjective_not_world_truth !== true
      || event.world_truth_verified !== false
      || event.committed_goal_is_selected_action !== false
      || event.action_plan_generated !== false
      || event.utility_score !== null
      || event.priority_score !== null
      || event.success_probability !== null
      || event.character_brain_direct_write !== false
      || event.status !== "motivational_goal_event_recorded") {
    const error = new Error(`MotivationalGoalEvent ${eventId} is invalid.`);
    error.code = "WORLD_SIMULATION_MOTIVATIONAL_GOAL_EVENT_INVALID";
    throw error;
  }
  normalizeTargetDescriptor(event.target_descriptor);
  normalizeRelations(event.motivation_relations);
  if (goalEventHash(event) !== event.goal_event_hash) {
    const error = new Error(`MotivationalGoalEvent ${eventId} failed hash verification.`);
    error.code = "WORLD_SIMULATION_MOTIVATIONAL_GOAL_EVENT_HASH_MISMATCH";
    throw error;
  }
  return event;
}

function validateGoalHistory(worldState) {
  if (Object.hasOwn(worldState, "motivational_goal_events") && !isObject(worldState.motivational_goal_events)) {
    const error = new Error("motivational_goal_events must be an object.");
    error.code = "WORLD_SIMULATION_MOTIVATIONAL_GOAL_EVENT_STORE_INVALID";
    throw error;
  }
  if (Object.hasOwn(worldState, "motivational_goal_history") && !Array.isArray(worldState.motivational_goal_history)) {
    const error = new Error("motivational_goal_history must be an array.");
    error.code = "WORLD_SIMULATION_MOTIVATIONAL_GOAL_HISTORY_INVALID";
    throw error;
  }
  const events = object(worldState.motivational_goal_events);
  const history = array(worldState.motivational_goal_history);
  const latestByCharacter = new Map();
  const stateByCharacterGoal = new Map();
  const seenEventIds = new Set();
  for (const [index, ref] of history.entries()) {
    if (!isObject(ref)
        || ref.schema_version !== motivationalGoalHistoryReferenceSchemaVersion
        || ref.derived_index !== true
        || !optionalString(ref.goal_event_id)
        || !optionalString(ref.goal_event_hash)
        || !optionalString(ref.goal_id)
        || !optionalString(ref.character)
        || !optionalString(ref.source_turn_id)
        || !supportedOperations.includes(ref.operation)
        || ref.status !== "motivational_goal_event_recorded") {
      const error = new Error(`motivational_goal_history[${index}] is invalid.`);
      error.code = "WORLD_SIMULATION_MOTIVATIONAL_GOAL_HISTORY_REFERENCE_INVALID";
      throw error;
    }
    if (seenEventIds.has(ref.goal_event_id)) {
      const error = new Error(`Duplicate motivational goal event ${ref.goal_event_id}.`);
      error.code = "WORLD_SIMULATION_MOTIVATIONAL_GOAL_IDENTITY_REUSE_FORBIDDEN";
      throw error;
    }
    const event = validatePersistedGoalEvent(events[ref.goal_event_id], ref.goal_event_id);
    const charKey = characterKey(event.character);
    const previous = latestByCharacter.get(charKey) ?? null;
    if (ref.goal_event_hash !== event.goal_event_hash
        || ref.goal_id !== event.goal_id
        || ref.character !== event.character
        || ref.source_turn_id !== event.source_turn_id
        || ref.operation !== event.operation
        || ref.previous_goal_event_id !== event.previous_goal_event_id
        || ref.previous_goal_event_hash !== event.previous_goal_event_hash
        || event.previous_goal_event_id !== (previous?.goal_event_id ?? null)
        || event.previous_goal_event_hash !== (previous?.goal_event_hash ?? null)) {
      const error = new Error(`Motivational goal history reference ${ref.goal_event_id} breaks its per-character chain.`);
      error.code = "WORLD_SIMULATION_MOTIVATIONAL_GOAL_HISTORY_REFERENCE_MISMATCH";
      throw error;
    }
    const stateKey = `${charKey}\u0000${event.goal_id}`;
    const priorState = stateByCharacterGoal.get(stateKey) ?? null;
    if (event.operation === "propose" && priorState !== null) throwGoalTransition(event, priorState);
    if (event.operation === "commit" && priorState !== "proposed") throwGoalTransition(event, priorState);
    if (event.operation === "suspend" && priorState !== "committed") throwGoalTransition(event, priorState);
    if (event.operation === "abandon" && !["proposed", "committed", "suspended"].includes(priorState)) throwGoalTransition(event, priorState);
    const nextState = event.operation === "propose" ? "proposed"
      : event.operation === "commit" ? "committed"
        : event.operation === "suspend" ? "suspended" : "abandoned";
    stateByCharacterGoal.set(stateKey, nextState);
    latestByCharacter.set(charKey, event);
    seenEventIds.add(event.goal_event_id);
  }
  return { events, history, latestByCharacter, stateByCharacterGoal };
}
function throwGoalTransition(event, priorState) {
  const error = new Error(`Illegal Phase68D ${event.operation} transition for ${event.goal_id} from ${priorState ?? "none"}.`);
  error.code = "WORLD_SIMULATION_MOTIVATIONAL_GOAL_STATE_TRANSITION_INVALID";
  throw error;
}

export function projectWorldSimulationEffectiveMotivationalGoals(input = {}) {
  const worldState = cloneJson(object(input.world_state));
  const validated = validateGoalHistory(worldState);
  const goalsByCharacter = {};
  validated.history.forEach((ref, historyIndex) => {
    const event = validated.events[ref.goal_event_id];
    goalsByCharacter[event.character] ??= {};
    const records = goalsByCharacter[event.character];
    if (event.operation === "propose") {
      records[event.goal_id] = {
        goal_id: event.goal_id,
        character: event.character,
        goal_kind: event.goal_kind,
        domain: event.domain,
        target_descriptor: cloneJson(event.target_descriptor),
        motivation_basis_refs: cloneJson(event.motivation_basis_refs),
        motivation_relations: cloneJson(event.motivation_relations),
        state: "proposed",
        latest_history_index: historyIndex,
        subjective_not_world_truth: true,
      };
    } else {
      const record = records[event.goal_id];
      if (!record) throwGoalTransition(event, null);
      record.state = event.operation === "commit" ? "committed"
        : event.operation === "suspend" ? "suspended" : "abandoned";
      record.latest_history_index = historyIndex;
    }
  });
  const projection = {
    version: effectiveMotivationalGoalProjectionVersion,
    source_version: worldSimulationMotivationGoalIntegrationVersion,
    goals_by_character: goalsByCharacter,
    source_history_hash: hashAgentRunValue(validated.history),
    replayed_event_count: validated.history.length,
    replayable_projection: true,
    proposed_is_not_committed: true,
    multiple_concurrent_goals_allowed: true,
    contradictory_goals_may_coexist: true,
    last_write_wins_applied: false,
    forced_global_goal_coherence_applied: false,
    numeric_utility_modeled: false,
    action_planning_modeled: false,
    selected_action_authority_claimed: false,
    world_truth_authority_claimed: false,
  };
  projection.projection_hash = hashAgentRunValue(projection);
  return deepFreeze(projection);
}

function findCharacterGoals(projection, character) {
  for (const [name, records] of Object.entries(projection.goals_by_character ?? {})) {
    if (sameCharacter(name, character)) return object(records);
  }
  return {};
}

export function buildWorldSimulationMotivationalGoalResolverView(input = {}) {
  const worldState = cloneJson(object(input.world_state));
  const turnId = boundedString(input.turn_id, "turn_id", 240);
  const sources = canonicalMotivationSources(worldState);
  const effective = projectWorldSimulationEffectiveMotivationalGoals({ world_state: worldState });
  const view = {
    version: worldSimulationMotivationGoalIntegrationVersion,
    turn_id: turnId,
    available_motivation_basis_refs: sources.map((source) => cloneJson(source)),
    effective_goals: cloneJson(effective.goals_by_character),
    supported_operations: [...supportedOperations],
    supported_goal_kinds: [...supportedGoalKinds],
    supported_motivation_relations: [...supportedRelations],
    proposed_is_not_committed: true,
    same_character_sources_and_goals_only: true,
    raw_world_state_exposed: false,
    raw_world_event_exposed: false,
    raw_memory_content_exposed: false,
    hidden_retrieval_graph_exposed: false,
    numeric_utility_requested: false,
    success_probability_requested: false,
    action_plan_requested: false,
    selected_action_requested: false,
    world_truth_judgment_requested: false,
  };
  view.resolver_view_hash = hashAgentRunValue(view);
  return deepFreeze(view);
}

function normalizeSourceRefs(rawRefs, character, resolverView) {
  const available = new Map(resolverView.available_motivation_basis_refs.map((ref) => [sourceRefKey(ref), ref]));
  const refs = array(rawRefs).map((raw, index) => {
    if (!isObject(raw)) {
      const error = new Error(`motivation_basis_refs[${index}] is invalid.`);
      error.code = "WORLD_SIMULATION_MOTIVATIONAL_GOAL_SOURCE_REF_INVALID";
      throw error;
    }
    const ref = {
      source_kind: boundedString(raw.source_kind, `motivation_basis_refs[${index}].source_kind`, 100, "WORLD_SIMULATION_MOTIVATIONAL_GOAL_SOURCE_REF_INVALID"),
      source_event_id: boundedString(raw.source_event_id, `motivation_basis_refs[${index}].source_event_id`, 240, "WORLD_SIMULATION_MOTIVATIONAL_GOAL_SOURCE_REF_INVALID"),
      source_event_hash: boundedString(raw.source_event_hash, `motivation_basis_refs[${index}].source_event_hash`, 128, "WORLD_SIMULATION_MOTIVATIONAL_GOAL_SOURCE_REF_INVALID"),
    };
    const found = available.get(sourceRefKey(ref));
    if (!found) {
      const error = new Error("Phase68D motivation basis is outside the bounded resolver view.");
      error.code = "WORLD_SIMULATION_MOTIVATIONAL_GOAL_SOURCE_OUT_OF_VIEW";
      throw error;
    }
    if (!sameCharacter(found.character, character)) {
      const error = new Error("Phase68D may use only same-character motivation basis evidence.");
      error.code = "WORLD_SIMULATION_MOTIVATIONAL_GOAL_CROSS_CHARACTER_SOURCE_FORBIDDEN";
      throw error;
    }
    return ref;
  }).sort((left, right) => compareText(sourceRefKey(left), sourceRefKey(right)));
  if (!refs.length || new Set(refs.map(sourceRefKey)).size !== refs.length || refs.length > 12) {
    const error = new Error("Phase68D motivation basis refs must be non-empty, unique, and bounded.");
    error.code = "WORLD_SIMULATION_MOTIVATIONAL_GOAL_SOURCE_REF_INVALID";
    throw error;
  }
  return refs;
}

function normalizeDecision(raw, resolverView, effectiveProjection) {
  if (!isObject(raw)) {
    const error = new Error("Phase68D goal decision must be an object.");
    error.code = "WORLD_SIMULATION_MOTIVATIONAL_GOAL_DECISION_INVALID";
    throw error;
  }
  const character = boundedString(raw.character, "decision.character", 240, "WORLD_SIMULATION_MOTIVATIONAL_GOAL_DECISION_INVALID");
  const operation = boundedString(raw.operation, "decision.operation", 80, "WORLD_SIMULATION_MOTIVATIONAL_GOAL_DECISION_INVALID");
  if (!supportedOperations.includes(operation)) {
    const error = new Error(`Unsupported Phase68D operation ${operation}.`);
    error.code = "WORLD_SIMULATION_MOTIVATIONAL_GOAL_OPERATION_UNSUPPORTED";
    throw error;
  }
  const resolverViewHash = boundedString(raw.resolver_view_hash ?? resolverView.resolver_view_hash, "resolver_view_hash", 128,
    "WORLD_SIMULATION_MOTIVATIONAL_GOAL_RESOLVER_VIEW_HASH_REQUIRED");
  if (resolverViewHash !== resolverView.resolver_view_hash) {
    const error = new Error("Phase68D decision does not pin the canonical resolver view.");
    error.code = "WORLD_SIMULATION_MOTIVATIONAL_GOAL_RESOLVER_VIEW_HASH_MISMATCH";
    throw error;
  }
  const records = findCharacterGoals(effectiveProjection, character);
  if (operation === "propose") {
    const goalKind = boundedString(raw.goal_kind, "goal_kind", 80, "WORLD_SIMULATION_MOTIVATIONAL_GOAL_DESCRIPTOR_INVALID");
    if (!supportedGoalKinds.includes(goalKind)) {
      const error = new Error(`Unsupported Phase68D goal kind ${goalKind}.`);
      error.code = "WORLD_SIMULATION_MOTIVATIONAL_GOAL_DESCRIPTOR_INVALID";
      throw error;
    }
    const domain = boundedString(raw.domain, "domain", 120, "WORLD_SIMULATION_MOTIVATIONAL_GOAL_DESCRIPTOR_INVALID");
    const targetDescriptor = normalizeTargetDescriptor(raw.target_descriptor);
    const refs = normalizeSourceRefs(raw.motivation_basis_refs, character, resolverView);
    const relations = normalizeRelations(raw.motivation_relations);
    const goalId = `motivational_goal_${hashAgentRunValue({
      version: worldSimulationMotivationGoalIntegrationVersion,
      character: characterKey(character), goal_kind: goalKind, domain, target_descriptor: targetDescriptor,
      motivation_basis_refs: refs,
    }).slice(0, 24)}`;
    if (records[goalId]) {
      const error = new Error(`Phase68D goal ${goalId} already exists.`);
      error.code = "WORLD_SIMULATION_MOTIVATIONAL_GOAL_IDENTITY_REUSE_FORBIDDEN";
      throw error;
    }
    return { character, operation, goal_id: goalId, goal_kind: goalKind, domain, target_descriptor: targetDescriptor,
      motivation_basis_refs: refs, motivation_relations: relations, resolver_view_hash: resolverViewHash };
  }
  const goalId = boundedString(raw.goal_id, "goal_id", 240, "WORLD_SIMULATION_MOTIVATIONAL_GOAL_TARGET_INVALID");
  const record = records[goalId];
  if (!record) {
    const error = new Error(`Phase68D target goal ${goalId} does not exist for ${character}.`);
    error.code = "WORLD_SIMULATION_MOTIVATIONAL_GOAL_TARGET_INVALID";
    throw error;
  }
  const requiredState = operation === "commit" ? "proposed" : operation === "suspend" ? "committed" : null;
  if ((requiredState && record.state !== requiredState)
      || (operation === "abandon" && !["proposed", "committed", "suspended"].includes(record.state))) {
    const error = new Error(`Illegal Phase68D ${operation} transition from ${record.state}.`);
    error.code = "WORLD_SIMULATION_MOTIVATIONAL_GOAL_STATE_TRANSITION_INVALID";
    throw error;
  }
  return {
    character, operation, goal_id: goalId, goal_kind: record.goal_kind, domain: record.domain,
    target_descriptor: cloneJson(record.target_descriptor), motivation_basis_refs: cloneJson(record.motivation_basis_refs),
    motivation_relations: cloneJson(record.motivation_relations), resolver_view_hash: resolverViewHash,
  };
}

function goalEventFor(decision, previous, turnId) {
  const base = {
    schema_version: motivationalGoalEventSchemaVersion,
    version: worldSimulationMotivationGoalIntegrationVersion,
    immutable: true,
    character: decision.character,
    source_turn_id: turnId,
    operation: decision.operation,
    goal_id: decision.goal_id,
    goal_kind: decision.goal_kind,
    domain: decision.domain,
    target_descriptor: cloneJson(decision.target_descriptor),
    motivation_basis_refs: cloneJson(decision.motivation_basis_refs),
    motivation_relations: cloneJson(decision.motivation_relations),
    resolver_view_hash: decision.resolver_view_hash,
    previous_goal_event_id: previous?.goal_event_id ?? null,
    previous_goal_event_hash: previous?.goal_event_hash ?? null,
    subjective_not_world_truth: true,
    world_truth_verified: false,
    proposed_is_not_committed: true,
    committed_goal_is_selected_action: false,
    action_plan_generated: false,
    utility_score: null,
    priority_score: null,
    success_probability: null,
    character_brain_direct_write: false,
    status: "motivational_goal_event_recorded",
  };
  const eventId = `motivational_goal_event_${hashAgentRunValue({
    version: worldSimulationMotivationGoalIntegrationVersion,
    character: characterKey(decision.character), source_turn_id: turnId, operation: decision.operation,
    goal_id: decision.goal_id, previous_goal_event_hash: previous?.goal_event_hash ?? null,
  }).slice(0, 24)}`;
  const event = { ...base, goal_event_id: eventId };
  event.goal_event_hash = goalEventHash(event);
  return deepFreeze(event);
}
function historyReferenceFor(event) {
  return deepFreeze({
    schema_version: motivationalGoalHistoryReferenceSchemaVersion,
    derived_index: true,
    goal_event_id: event.goal_event_id,
    goal_event_hash: event.goal_event_hash,
    goal_id: event.goal_id,
    character: event.character,
    source_turn_id: event.source_turn_id,
    operation: event.operation,
    previous_goal_event_id: event.previous_goal_event_id,
    previous_goal_event_hash: event.previous_goal_event_hash,
    status: event.status,
  });
}

export function buildWorldSimulationMotivationGoalIntegrationContract() {
  return deepFreeze({
    version: worldSimulationMotivationGoalIntegrationVersion,
    phase: "Phase68D",
    status: "motivation_goal_integration_installed",
    supported_operations: [...supportedOperations],
    supported_goal_kinds: [...supportedGoalKinds],
    supported_motivation_relations: [...supportedRelations],
    proposed_is_not_committed: true,
    commit_is_explicit: true,
    suspend_and_abandon_are_explicit: true,
    multiple_concurrent_goals_allowed: true,
    contradictory_goals_may_coexist: true,
    immutable_goal_event_write_once_required: true,
    append_only_goal_history_required: true,
    per_character_previous_event_hash_chain_required: true,
    same_character_motivation_basis_only: true,
    last_write_wins_allowed: false,
    forced_global_goal_coherence_required: false,
    numeric_motivation_strength_modeled: false,
    expected_utility_modeled: false,
    success_probability_modeled: false,
    action_planning_modeled: false,
    selected_action_authority_claimed: false,
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

export function buildWorldSimulationMotivationalGoalEvents(input = {}) {
  const worldState = cloneJson(object(input.world_state));
  const turnId = boundedString(input.turn_id, "turn_id", 240);
  const rawDecisions = array(input.goal_decisions);
  const inputSnapshot = cloneJson({ world_state: worldState, turn_id: turnId, goal_decisions: rawDecisions });
  const inputHash = hashAgentRunValue(inputSnapshot);
  const existing = validateGoalHistory(worldState);
  const effective = projectWorldSimulationEffectiveMotivationalGoals({ world_state: worldState });
  const resolverView = buildWorldSimulationMotivationalGoalResolverView({ world_state: worldState, turn_id: turnId });
  const decisions = rawDecisions.map((decision) => normalizeDecision(decision, resolverView, effective));
  const existingTurnGoalKeys = new Set(existing.history
    .map((ref) => existing.events[ref.goal_event_id])
    .filter((event) => event?.source_turn_id === turnId)
    .map((event) => `${characterKey(event.character)}\u0000${event.goal_id}`));
  const seenTurnGoalKeys = new Set();
  for (const decision of decisions) {
    const key = `${characterKey(decision.character)}\u0000${decision.goal_id}`;
    if (existingTurnGoalKeys.has(key) || seenTurnGoalKeys.has(key)) {
      const error = new Error(`Phase68D allows at most one durable transition per character/goal per turn: ${decision.goal_id}.`);
      error.code = "WORLD_SIMULATION_MOTIVATIONAL_GOAL_PER_GOAL_TURN_LIMIT";
      throw error;
    }
    seenTurnGoalKeys.add(key);
  }
  const preview = cloneJson(worldState);
  const latestByCharacter = new Map(existing.latestByCharacter);
  const createdEvents = [];
  const appendedReferences = [];
  const stateTransitions = [];
  for (const decision of decisions) {
    const key = characterKey(decision.character);
    const event = goalEventFor(decision, latestByCharacter.get(key) ?? null, turnId);
    preview.motivational_goal_events = object(preview.motivational_goal_events);
    if (preview.motivational_goal_events[event.goal_event_id]) {
      const error = new Error(`Phase68D goal event ${event.goal_event_id} already exists.`);
      error.code = "WORLD_SIMULATION_MOTIVATIONAL_GOAL_EVENT_IMMUTABILITY_VIOLATION";
      throw error;
    }
    preview.motivational_goal_events[event.goal_event_id] = cloneJson(event);
    const ref = historyReferenceFor(event);
    createdEvents.push(event);
    appendedReferences.push(ref);
    latestByCharacter.set(key, event);
    stateTransitions.push({
      entity: "world", field: `motivational_goal_events.${event.goal_event_id}`, from: null, to: cloneJson(event),
      cause: `persist immutable MotivationalGoalEvent ${event.goal_event_id}`, source_layer: "motivation_goal_integration",
    });
  }
  if (appendedReferences.length) {
    const nextHistory = [...existing.history.map(cloneJson), ...appendedReferences.map(cloneJson)];
    preview.motivational_goal_history = nextHistory;
    stateTransitions.push({
      entity: "world", field: "motivational_goal_history", from: cloneJson(worldState.motivational_goal_history ?? null),
      to: cloneJson(nextHistory), cause: `append ${appendedReferences.length} Phase68D motivational goal history reference(s)`,
      source_layer: "motivation_goal_integration",
    });
  }
  const effectiveProjection = projectWorldSimulationEffectiveMotivationalGoals({ world_state: preview });
  if (hashAgentRunValue(inputSnapshot) !== inputHash) {
    const error = new Error("Phase68D motivation/goal integration mutated its input snapshot.");
    error.code = "WORLD_SIMULATION_MOTIVATIONAL_GOAL_INPUT_MUTATED";
    throw error;
  }
  return deepFreeze({
    ok: true,
    version: worldSimulationMotivationGoalIntegrationVersion,
    result: {
      goal_decision_count: decisions.length,
      goal_events_created: createdEvents,
      history_references_appended: appendedReferences,
      state_transitions: stateTransitions,
      preview_world_state: preview,
      resolver_view_hash: resolverView.resolver_view_hash,
      effective_motivational_goal_projection: effectiveProjection,
      audit: {
        proposed_is_not_committed: true,
        explicit_state_transitions_only: true,
        same_character_motivation_basis_only: true,
        multiple_concurrent_goals_allowed: true,
        contradictory_goals_may_coexist: true,
        last_write_wins_applied: false,
        forced_global_goal_coherence_applied: false,
        numeric_utility_modeled: false,
        success_probability_modeled: false,
        action_planning_modeled: false,
        selected_action_authority_claimed: false,
        world_truth_authority_claimed: false,
        same_turn_character_brain_feedback_allowed: false,
      },
    },
  });
}

function assertNoSameTurnWrites(worldState, character, currentTurnId) {
  for (const ref of array(worldState.motivational_goal_history)) {
    if (sameCharacter(ref?.character, character) && ref?.source_turn_id === currentTurnId) {
      const error = new Error(`Phase68D cannot expose motivational state after same-turn write for ${character}.`);
      error.code = "WORLD_SIMULATION_MOTIVATIONAL_GOAL_SAME_TURN_CONTAMINATION";
      throw error;
    }
  }
}
export function projectWorldSimulationMotivationalGoalsForCharacter(input = {}) {
  const worldState = cloneJson(object(input.world_state));
  const character = boundedString(input.character, "character", 240);
  const currentTurnId = boundedString(input.current_turn_id, "current_turn_id", 240);
  const inputHash = hashAgentRunValue(worldState);
  assertNoSameTurnWrites(worldState, character, currentTurnId);
  const effective = projectWorldSimulationEffectiveMotivationalGoals({ world_state: worldState });
  const records = Object.values(findCharacterGoals(effective, character))
    .filter((record) => ["committed", "suspended"].includes(record.state))
    .sort((left, right) => Number(right.latest_history_index) - Number(left.latest_history_index)
      || compareText(left.domain, right.domain));
  const selected = records.slice(0, motivationalGoalMaxCharacterItems);
  const goals = selected.map((record) => ({
    goal_kind: record.goal_kind,
    domain: record.domain,
    target: cloneJson(record.target_descriptor),
    state: record.state,
    motivation_relations: cloneJson(record.motivation_relations),
    subjective_not_world_truth: true,
  }));
  const characterView = {
    source: "committed_prior_turn_effective_motivational_goal_state",
    goals,
    goals_truncated: selected.length < records.length,
    proposed_candidates_hidden: true,
    numeric_utility_priority_probability_exposed: false,
    action_plan_exposed: false,
    selected_action_authority_exposed: false,
  };
  if (hashAgentRunValue(worldState) !== inputHash) {
    const error = new Error("Phase68D bounded goal projection mutated its input.");
    error.code = "WORLD_SIMULATION_MOTIVATIONAL_GOAL_INPUT_MUTATED";
    throw error;
  }
  return deepFreeze({
    ok: true,
    version: motivationalGoalCharacterProjectionVersion,
    source_projection_version: effectiveMotivationalGoalProjectionVersion,
    character,
    current_turn_id: currentTurnId,
    character_view: characterView,
    character_view_hash: hashAgentRunValue(characterView),
    audit: {
      source_projection_hash: effective.projection_hash,
      source_goal_count: records.length,
      projected_goal_count: selected.length,
      goal_ids_exposed: false,
      goal_event_ids_exposed: false,
      source_ids_hashes_exposed: false,
      world_truth_authority_exposed: false,
      numeric_utility_priority_probability_exposed: false,
      action_plan_exposed: false,
      selected_action_authority_exposed: false,
      same_turn_feedback_allowed: false,
    },
  });
}
