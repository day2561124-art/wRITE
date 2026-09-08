import { hashAgentRunValue } from "./agent-run-service.mjs";
import {
  projectWorldSimulationEffectiveMotivationalGoalLifecycle,
} from "./world-simulation-goal-achievement-verification-service.mjs";

export const worldSimulationGoalViabilityUnattainabilityVersion =
  "phase70b-goal-viability-unattainability-v1";
export const motivationalGoalUnattainabilityEventSchemaVersion =
  "phase70b-motivational-goal-unattainability-event-v1";
export const motivationalGoalUnattainabilityHistoryReferenceSchemaVersion =
  "phase70b-motivational-goal-unattainability-history-ref-v1";
export const effectiveMotivationalGoalViabilityProjectionVersion =
  "phase70b-effective-motivational-goal-viability-projection-v1";

const supportedOperations = Object.freeze(["verify_unattainable"]);
const eligibleGoalKinds = Object.freeze(["achieve_state", "restore_state"]);
const eligibleGoalStates = Object.freeze(["committed", "suspended"]);
const evidenceKinds = Object.freeze([
  "causal_state_transition",
  "action_outcome",
  "knowledge_transition",
]);
const structuralEvidenceKinds = Object.freeze([
  "causal_state_transition",
  "knowledge_transition",
]);
const basisKinds = Object.freeze([
  "irreversible_deadline_expiry",
  "permanent_target_unavailability",
  "irreversible_required_resource_loss",
  "mutually_exclusive_world_transition",
  "proven_goal_condition_unsatisfiable",
]);

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
  code = "WORLD_SIMULATION_GOAL_VIABILITY_INPUT_INVALID",
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
function unattainabilityEventHash(event) {
  return hashWithout(event, "goal_unattainability_event_hash");
}

function sanitizeEvidence(value, depth = 0) {
  if (depth > 8) return null;
  if (Array.isArray(value)) {
    return value.slice(0, 64).map((item) => sanitizeEvidence(item, depth + 1));
  }
  if (!isObject(value)) {
    if (typeof value === "string") return value.slice(0, 1200);
    if (typeof value === "number" || typeof value === "boolean" || value == null) {
      return value;
    }
    return null;
  }
  const clean = {};
  for (const [key, child] of Object.entries(value).slice(0, 96)) {
    if ([
      "world_state",
      "next_world_state",
      "preview_world_state",
      "memory_store",
      "hidden_retrieval_graph",
    ].includes(String(key).toLowerCase())) continue;
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

function validatePersistedUnattainabilityEvent(event, eventId) {
  if (!isObject(event)
      || event.schema_version !== motivationalGoalUnattainabilityEventSchemaVersion
      || event.version !== worldSimulationGoalViabilityUnattainabilityVersion
      || event.immutable !== true
      || event.goal_unattainability_event_id !== eventId
      || !optionalString(event.goal_unattainability_event_hash)
      || !optionalString(event.character)
      || !optionalString(event.source_turn_id)
      || event.operation !== "verify_unattainable"
      || !optionalString(event.goal_id)
      || !eligibleGoalKinds.includes(event.goal_kind)
      || !optionalString(event.source_goal_event_id)
      || !optionalString(event.source_goal_event_hash)
      || !optionalString(event.goal_projection_hash)
      || !basisKinds.includes(event.unattainability_basis_kind)
      || !Array.isArray(event.unattainability_evidence_refs)
      || event.unattainability_evidence_refs.length < 1
      || event.unattainability_evidence_refs.length > 16
      || !optionalString(event.resolver_view_hash)
      || event.explicit_unattainability_verification !== true
      || event.structural_authoritative_evidence_required !== true
      || event.action_failure_alone_sufficient !== false
      || event.plan_failure_alone_sufficient !== false
      || event.lack_of_progress_alone_sufficient !== false
      || event.unattainability_is_abandonment !== false
      || event.automatic_disengagement !== false
      || event.automatic_reengagement !== false
      || event.automatic_replanning !== false
      || event.goal_state_mutated !== false
      || event.world_state_scanned !== false
      || event.numeric_scoring_modeled !== false
      || event.character_brain_direct_write !== false
      || event.status !== "motivational_goal_unattainability_recorded") {
    const error = new Error(`MotivationalGoalUnattainabilityEvent ${eventId} is invalid.`);
    error.code = "WORLD_SIMULATION_GOAL_UNATTAINABILITY_EVENT_INVALID";
    throw error;
  }
  const refs = new Set();
  let hasStructuralEvidence = false;
  let previousEvidenceKey = null;
  for (const ref of event.unattainability_evidence_refs) {
    const evidenceKey = JSON.stringify([
      ref?.evidence_kind,
      ref?.evidence_ref,
      ref?.evidence_hash,
    ]);
    if (!isObject(ref)
        || !evidenceKinds.includes(ref.evidence_kind)
        || !optionalString(ref.evidence_ref)
        || !optionalString(ref.evidence_hash)
        || refs.has(ref.evidence_ref)
        || (previousEvidenceKey !== null
          && previousEvidenceKey.localeCompare(evidenceKey, "en") > 0)) {
      const error = new Error(
        `MotivationalGoalUnattainabilityEvent ${eventId} has invalid evidence refs.`,
      );
      error.code = "WORLD_SIMULATION_GOAL_UNATTAINABILITY_EVIDENCE_REF_INVALID";
      throw error;
    }
    refs.add(ref.evidence_ref);
    previousEvidenceKey = evidenceKey;
    if (structuralEvidenceKinds.includes(ref.evidence_kind)) hasStructuralEvidence = true;
  }
  if (!hasStructuralEvidence) {
    const error = new Error(
      `MotivationalGoalUnattainabilityEvent ${eventId} lacks structural authoritative evidence.`,
    );
    error.code = "WORLD_SIMULATION_GOAL_UNATTAINABILITY_STRUCTURAL_EVIDENCE_REQUIRED";
    throw error;
  }
  if (unattainabilityEventHash(event) !== event.goal_unattainability_event_hash) {
    const error = new Error(
      `MotivationalGoalUnattainabilityEvent ${eventId} failed hash verification.`,
    );
    error.code = "WORLD_SIMULATION_GOAL_UNATTAINABILITY_EVENT_HASH_MISMATCH";
    throw error;
  }
  return event;
}

function validateUnattainabilityHistory(worldState) {
  if (Object.hasOwn(worldState, "motivational_goal_unattainability_events")
      && !isObject(worldState.motivational_goal_unattainability_events)) {
    const error = new Error("motivational_goal_unattainability_events must be an object.");
    error.code = "WORLD_SIMULATION_GOAL_UNATTAINABILITY_EVENT_STORE_INVALID";
    throw error;
  }
  if (Object.hasOwn(worldState, "motivational_goal_unattainability_history")
      && !Array.isArray(worldState.motivational_goal_unattainability_history)) {
    const error = new Error("motivational_goal_unattainability_history must be an array.");
    error.code = "WORLD_SIMULATION_GOAL_UNATTAINABILITY_HISTORY_INVALID";
    throw error;
  }
  const events = object(worldState.motivational_goal_unattainability_events);
  const history = array(worldState.motivational_goal_unattainability_history);
  const latestByCharacter = new Map();
  const unattainableGoals = new Set();
  const seenEventIds = new Set();
  for (const [index, ref] of history.entries()) {
    if (!isObject(ref)
        || ref.schema_version !== motivationalGoalUnattainabilityHistoryReferenceSchemaVersion
        || ref.derived_index !== true
        || !optionalString(ref.goal_unattainability_event_id)
        || !optionalString(ref.goal_unattainability_event_hash)
        || !optionalString(ref.goal_id)
        || !optionalString(ref.character)
        || !optionalString(ref.source_turn_id)
        || ref.operation !== "verify_unattainable"
        || !basisKinds.includes(ref.unattainability_basis_kind)
        || ref.status !== "motivational_goal_unattainability_recorded") {
      const error = new Error(`motivational_goal_unattainability_history[${index}] is invalid.`);
      error.code = "WORLD_SIMULATION_GOAL_UNATTAINABILITY_HISTORY_REFERENCE_INVALID";
      throw error;
    }
    if (seenEventIds.has(ref.goal_unattainability_event_id)) {
      const error = new Error(`Duplicate Phase70B event ${ref.goal_unattainability_event_id}.`);
      error.code = "WORLD_SIMULATION_GOAL_UNATTAINABILITY_IDENTITY_REUSE_FORBIDDEN";
      throw error;
    }
    const event = validatePersistedUnattainabilityEvent(
      events[ref.goal_unattainability_event_id],
      ref.goal_unattainability_event_id,
    );
    const key = characterKey(event.character);
    const goalKey = `${key}\u0000${event.goal_id}`;
    const previous = latestByCharacter.get(key) ?? null;
    if (unattainableGoals.has(goalKey)) {
      const error = new Error(`Phase70B goal ${event.goal_id} was marked unattainable more than once.`);
      error.code = "WORLD_SIMULATION_GOAL_UNATTAINABILITY_DUPLICATE_FORBIDDEN";
      throw error;
    }
    if (ref.goal_unattainability_event_hash !== event.goal_unattainability_event_hash
        || ref.goal_id !== event.goal_id
        || ref.character !== event.character
        || ref.source_turn_id !== event.source_turn_id
        || ref.unattainability_basis_kind !== event.unattainability_basis_kind
        || ref.previous_goal_unattainability_event_id
          !== event.previous_goal_unattainability_event_id
        || ref.previous_goal_unattainability_event_hash
          !== event.previous_goal_unattainability_event_hash
        || event.previous_goal_unattainability_event_id
          !== (previous?.goal_unattainability_event_id ?? null)
        || event.previous_goal_unattainability_event_hash
          !== (previous?.goal_unattainability_event_hash ?? null)) {
      const error = new Error(
        `Phase70B history reference ${ref.goal_unattainability_event_id} breaks its per-character chain.`,
      );
      error.code = "WORLD_SIMULATION_GOAL_UNATTAINABILITY_HISTORY_REFERENCE_MISMATCH";
      throw error;
    }
    seenEventIds.add(event.goal_unattainability_event_id);
    unattainableGoals.add(goalKey);
    latestByCharacter.set(key, event);
  }
  return { events, history, latestByCharacter, unattainableGoals, seenEventIds };
}

export function projectWorldSimulationEffectiveMotivationalGoalViability(input = {}) {
  const worldState = cloneJson(object(input.world_state));
  const lifecycle = projectWorldSimulationEffectiveMotivationalGoalLifecycle({
    world_state: worldState,
  });
  const unattainability = validateUnattainabilityHistory(worldState);
  const goalsByCharacter = cloneJson(lifecycle.goals_by_character);
  for (const records of Object.values(goalsByCharacter)) {
    for (const record of Object.values(object(records))) {
      record.unattainable = false;
      record.latest_unattainability_event_id = null;
      record.unattainability_basis_kind = null;
    }
  }
  unattainability.history.forEach((ref) => {
    const event = unattainability.events[ref.goal_unattainability_event_id];
    const records = findCharacterGoals({ goals_by_character: goalsByCharacter }, event.character);
    const goal = records[event.goal_id];
    if (!goal
        || goal.achieved === true
        || !eligibleGoalStates.includes(goal.state)
        || goal.goal_kind !== event.goal_kind) {
      const error = new Error(`Phase70B target goal ${event.goal_id} is invalid during replay.`);
      error.code = "WORLD_SIMULATION_GOAL_UNATTAINABILITY_TARGET_INVALID";
      throw error;
    }
    const source = latestGoalEvent(worldState, event.character, event.goal_id);
    if (!source
        || source.goal_event_id !== event.source_goal_event_id
        || source.goal_event_hash !== event.source_goal_event_hash) {
      const error = new Error(
        `Phase70B event ${event.goal_unattainability_event_id} does not pin the current canonical source goal event.`,
      );
      error.code = "WORLD_SIMULATION_GOAL_UNATTAINABILITY_SOURCE_GOAL_INVALID";
      throw error;
    }
    goal.unattainable = true;
    goal.latest_unattainability_event_id = event.goal_unattainability_event_id;
    goal.unattainability_basis_kind = event.unattainability_basis_kind;
  });
  const projection = {
    version: effectiveMotivationalGoalViabilityProjectionVersion,
    source_phase70a_projection_version: lifecycle.version,
    source_phase70a_projection_hash: lifecycle.projection_hash,
    goals_by_character: goalsByCharacter,
    unattainability_history_hash: hashAgentRunValue(unattainability.history),
    replayed_unattainability_event_count: unattainability.history.length,
    replayable_projection: true,
    unattainability_is_explicit: true,
    unattainability_is_terminal_within_world_lineage_v1: true,
    abandonment_remains_distinct: true,
    automatic_disengagement: false,
    automatic_reengagement: false,
    automatic_replanning: false,
    action_failure_alone_sufficient: false,
    plan_failure_alone_sufficient: false,
    lack_of_progress_alone_sufficient: false,
    numeric_success_probability_modeled: false,
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
      evidence_ref: `phase70b_evidence_${hashAgentRunValue({
        version: worldSimulationGoalViabilityUnattainabilityVersion,
        turn_id: turnId,
        kind,
        index,
        evidence_hash: evidenceHash,
      }).slice(0, 24)}`,
      evidence_hash: evidenceHash,
      evidence,
    };
  });
}

export function buildWorldSimulationGoalViabilityResolverView(input = {}) {
  const worldState = cloneJson(object(input.world_state));
  const turnId = boundedString(input.turn_id, "turn_id");
  const viability = projectWorldSimulationEffectiveMotivationalGoalViability({
    world_state: worldState,
  });
  const goals = [];
  for (const [character, records] of Object.entries(viability.goals_by_character ?? {})) {
    for (const goal of Object.values(object(records))) {
      if (goal.achieved === true
          || goal.unattainable === true
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
        goal_ref: `phase70b_goal_${hashAgentRunValue({
          version: worldSimulationGoalViabilityUnattainabilityVersion,
          descriptor,
        }).slice(0, 24)}`,
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
    version: worldSimulationGoalViabilityUnattainabilityVersion,
    turn_id: turnId,
    goal_projection_hash: viability.projection_hash,
    eligible_goals: goals,
    authoritative_evidence: evidence,
    supported_operations: [...supportedOperations],
    supported_unattainability_basis_kinds: [...basisKinds],
    eligible_goal_kinds: [...eligibleGoalKinds],
    eligible_goal_states: [...eligibleGoalStates],
    explicit_unattainability_verification_required: true,
    authoritative_evidence_ref_required: true,
    structural_authoritative_evidence_required: true,
    action_outcome_only_sufficient: false,
    action_failure_alone_sufficient: false,
    plan_failure_alone_sufficient: false,
    lack_of_progress_alone_sufficient: false,
    automatic_abandonment_requested: false,
    automatic_disengagement_requested: false,
    automatic_reengagement_requested: false,
    autonomous_replanning_requested: false,
    maintain_or_avoid_unattainability_supported: false,
    raw_world_state_exposed: false,
    raw_memory_store_exposed: false,
    hidden_retrieval_graph_exposed: false,
    numeric_success_probability_requested: false,
    expected_utility_requested: false,
    action_selection_requested: false,
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
    version: worldSimulationGoalViabilityUnattainabilityVersion,
    turn_id: resolverView.turn_id,
    resolver_view_hash: resolverView.resolver_view_hash,
    goal_projection_hash: resolverView.goal_projection_hash,
    authoritative_evidence: authoritativeEvidence,
    structural_evidence_kinds: [...structuralEvidenceKinds],
    bounded_current_turn_evidence_catalog: true,
    raw_world_state_exposed: false,
  };
  context.context_hash = hashAgentRunValue(context);
  return deepFreeze(context);
}

function normalizeDecision(raw, resolverView, viability) {
  if (!isObject(raw)) {
    const error = new Error("Phase70B unattainability decision must be an object.");
    error.code = "WORLD_SIMULATION_GOAL_UNATTAINABILITY_DECISION_INVALID";
    throw error;
  }
  if ((raw.operation ?? "verify_unattainable") !== "verify_unattainable") {
    const error = new Error(`Unsupported Phase70B operation ${raw.operation}.`);
    error.code = "WORLD_SIMULATION_GOAL_UNATTAINABILITY_OPERATION_UNSUPPORTED";
    throw error;
  }
  const goalRef = boundedString(
    raw.goal_ref,
    "goal_ref",
    180,
    "WORLD_SIMULATION_GOAL_UNATTAINABILITY_TARGET_INVALID",
  );
  const goal = resolverView.eligible_goals.find((candidate) => candidate.goal_ref === goalRef);
  if (!goal) {
    const error = new Error(`Unknown or ineligible Phase70B goal ref ${goalRef}.`);
    error.code = "WORLD_SIMULATION_GOAL_UNATTAINABILITY_TARGET_INVALID";
    throw error;
  }
  const records = findCharacterGoals(viability, goal.character);
  const current = records[goal.goal_id];
  if (!current
      || current.achieved === true
      || current.unattainable === true
      || !eligibleGoalStates.includes(current.state)
      || !eligibleGoalKinds.includes(current.goal_kind)) {
    const error = new Error(
      `Phase70B target goal ${goal.goal_id} is unavailable, achieved, or already unattainable.`,
    );
    error.code = "WORLD_SIMULATION_GOAL_UNATTAINABILITY_TARGET_INVALID";
    throw error;
  }
  const basisKind = boundedString(
    raw.unattainability_basis_kind,
    "unattainability_basis_kind",
    96,
    "WORLD_SIMULATION_GOAL_UNATTAINABILITY_BASIS_INVALID",
  );
  if (!basisKinds.includes(basisKind)) {
    const error = new Error(`Unsupported Phase70B unattainability basis ${basisKind}.`);
    error.code = "WORLD_SIMULATION_GOAL_UNATTAINABILITY_BASIS_INVALID";
    throw error;
  }
  const rawRefs = array(raw.evidence_refs);
  if (!rawRefs.length || rawRefs.length > 16) {
    const error = new Error(
      "Phase70B unattainability requires one to sixteen explicit evidence refs.",
    );
    error.code = "WORLD_SIMULATION_GOAL_UNATTAINABILITY_EVIDENCE_REF_INVALID";
    throw error;
  }
  const evidenceMap = new Map(
    resolverView.authoritative_evidence.map((entry) => [entry.evidence_ref, entry]),
  );
  const selected = [];
  const seen = new Set();
  let hasStructuralEvidence = false;
  for (const rawRef of rawRefs) {
    const ref = boundedString(
      rawRef,
      "evidence_ref",
      180,
      "WORLD_SIMULATION_GOAL_UNATTAINABILITY_EVIDENCE_REF_INVALID",
    );
    const evidence = evidenceMap.get(ref);
    if (!evidence || seen.has(ref)) {
      const error = new Error(`Phase70B evidence ref ${ref} is non-canonical or duplicated.`);
      error.code = "WORLD_SIMULATION_GOAL_UNATTAINABILITY_EVIDENCE_REF_INVALID";
      throw error;
    }
    seen.add(ref);
    selected.push({
      evidence_kind: evidence.evidence_kind,
      evidence_ref: evidence.evidence_ref,
      evidence_hash: evidence.evidence_hash,
    });
    if (structuralEvidenceKinds.includes(evidence.evidence_kind)) {
      hasStructuralEvidence = true;
    }
  }
  if (!hasStructuralEvidence) {
    const error = new Error(
      "Phase70B unattainability requires structural authoritative state/knowledge evidence; action outcome alone is insufficient.",
    );
    error.code = "WORLD_SIMULATION_GOAL_UNATTAINABILITY_STRUCTURAL_EVIDENCE_REQUIRED";
    throw error;
  }
  selected.sort((left, right) => compareText(left.evidence_kind, right.evidence_kind)
    || compareText(left.evidence_ref, right.evidence_ref)
    || compareText(left.evidence_hash, right.evidence_hash));
  return {
    character: goal.character,
    operation: "verify_unattainable",
    goal_id: goal.goal_id,
    goal_kind: goal.goal_kind,
    source_goal_event_id: goal.source_goal_event_id,
    source_goal_event_hash: goal.source_goal_event_hash,
    goal_projection_hash: resolverView.goal_projection_hash,
    unattainability_basis_kind: basisKind,
    unattainability_evidence_refs: selected,
    resolver_view_hash: resolverView.resolver_view_hash,
    reason: optionalString(raw.reason) ?? "explicit_programmatic_goal_unattainability_verification",
    source: optionalString(raw.source) ?? "programmatic_goal_viability_resolver",
  };
}

function eventFor(decision, previous, turnId) {
  const base = {
    schema_version: motivationalGoalUnattainabilityEventSchemaVersion,
    version: worldSimulationGoalViabilityUnattainabilityVersion,
    immutable: true,
    character: decision.character,
    source_turn_id: turnId,
    operation: "verify_unattainable",
    goal_id: decision.goal_id,
    goal_kind: decision.goal_kind,
    source_goal_event_id: decision.source_goal_event_id,
    source_goal_event_hash: decision.source_goal_event_hash,
    goal_projection_hash: decision.goal_projection_hash,
    unattainability_basis_kind: decision.unattainability_basis_kind,
    unattainability_evidence_refs: cloneJson(decision.unattainability_evidence_refs),
    resolver_view_hash: decision.resolver_view_hash,
    previous_goal_unattainability_event_id:
      previous?.goal_unattainability_event_id ?? null,
    previous_goal_unattainability_event_hash:
      previous?.goal_unattainability_event_hash ?? null,
    unattainability_evidence: {
      decision_source: decision.source,
      decision_reason: decision.reason,
      basis_kind: decision.unattainability_basis_kind,
      explicit_unattainability_verification: true,
      current_world_lineage_scope: true,
    },
    explicit_unattainability_verification: true,
    structural_authoritative_evidence_required: true,
    action_failure_alone_sufficient: false,
    plan_failure_alone_sufficient: false,
    lack_of_progress_alone_sufficient: false,
    unattainability_is_abandonment: false,
    automatic_disengagement: false,
    automatic_reengagement: false,
    automatic_replanning: false,
    goal_state_mutated: false,
    world_state_scanned: false,
    numeric_scoring_modeled: false,
    character_brain_direct_write: false,
    status: "motivational_goal_unattainability_recorded",
  };
  const eventId = `motivational_goal_unattainability_event_${hashAgentRunValue({
    version: worldSimulationGoalViabilityUnattainabilityVersion,
    character: characterKey(decision.character),
    source_turn_id: turnId,
    goal_id: decision.goal_id,
    basis_kind: decision.unattainability_basis_kind,
    evidence_refs: decision.unattainability_evidence_refs,
    previous_goal_unattainability_event_hash:
      previous?.goal_unattainability_event_hash ?? null,
  }).slice(0, 24)}`;
  const event = { ...base, goal_unattainability_event_id: eventId };
  event.goal_unattainability_event_hash = unattainabilityEventHash(event);
  return deepFreeze(event);
}

function historyRefFor(event) {
  return deepFreeze({
    schema_version: motivationalGoalUnattainabilityHistoryReferenceSchemaVersion,
    derived_index: true,
    goal_unattainability_event_id: event.goal_unattainability_event_id,
    goal_unattainability_event_hash: event.goal_unattainability_event_hash,
    goal_id: event.goal_id,
    character: event.character,
    source_turn_id: event.source_turn_id,
    operation: event.operation,
    unattainability_basis_kind: event.unattainability_basis_kind,
    previous_goal_unattainability_event_id:
      event.previous_goal_unattainability_event_id,
    previous_goal_unattainability_event_hash:
      event.previous_goal_unattainability_event_hash,
    status: event.status,
  });
}

export function buildWorldSimulationGoalViabilityUnattainabilityContract() {
  return deepFreeze({
    version: worldSimulationGoalViabilityUnattainabilityVersion,
    phase: "Phase70B",
    status: "explicit_goal_viability_unattainability_verification_installed",
    supported_operations: [...supportedOperations],
    supported_unattainability_basis_kinds: [...basisKinds],
    eligible_goal_kinds: [...eligibleGoalKinds],
    eligible_goal_states: [...eligibleGoalStates],
    explicit_unattainability_verification_required: true,
    authoritative_evidence_ref_required: true,
    structural_authoritative_evidence_required: true,
    action_outcome_only_sufficient: false,
    immutable_unattainability_event_write_once_required: true,
    append_only_unattainability_history_required: true,
    per_character_previous_event_hash_chain_required: true,
    unattainability_terminal_within_world_lineage_v1: true,
    achievement_and_unattainability_mutually_exclusive: true,
    unattainability_is_abandonment: false,
    automatic_goal_abandonment: false,
    automatic_disengagement: false,
    automatic_reengagement: false,
    autonomous_replanning: false,
    action_failure_alone_sufficient: false,
    plan_failure_alone_sufficient: false,
    lack_of_progress_alone_sufficient: false,
    maintain_or_avoid_unattainability_supported: false,
    numeric_success_probability_expected_utility_confidence_modeled: false,
    raw_world_state_scan_allowed: false,
    character_brain_direct_durable_write_allowed: false,
    authoritative_mutation_owner: "phase62k-authoritative-mutation-executor-v1",
    deterministic_replay_required: true,
    input_immutability_required: true,
  });
}

export function buildWorldSimulationGoalUnattainabilityEvents(input = {}) {
  const worldState = cloneJson(object(input.world_state));
  const turnId = boundedString(input.turn_id, "turn_id");
  const rawDecisions = array(input.unattainability_decisions);
  const resolverView = input.resolver_view
    ? cloneJson(input.resolver_view)
    : buildWorldSimulationGoalViabilityResolverView({
      world_state: worldState,
      turn_id: turnId,
      state_transitions: input.state_transitions,
      action_outcomes: input.action_outcomes,
      knowledge_transitions: input.knowledge_transitions,
    });
  const canonicalHash = hashAgentRunValue(
    Object.fromEntries(
      Object.entries(resolverView).filter(([key]) => key !== "resolver_view_hash"),
    ),
  );
  if (resolverView.version !== worldSimulationGoalViabilityUnattainabilityVersion
      || resolverView.turn_id !== turnId
      || canonicalHash !== resolverView.resolver_view_hash) {
    const error = new Error("Phase70B requires an exact canonical viability resolver view.");
    error.code = "WORLD_SIMULATION_GOAL_UNATTAINABILITY_RESOLVER_VIEW_INVALID";
    throw error;
  }
  const inputSnapshot = cloneJson({
    world_state: worldState,
    turn_id: turnId,
    unattainability_decisions: rawDecisions,
    resolver_view: resolverView,
  });
  const inputHash = hashAgentRunValue(inputSnapshot);
  const existing = validateUnattainabilityHistory(worldState);
  const viability = projectWorldSimulationEffectiveMotivationalGoalViability({
    world_state: worldState,
  });
  const decisions = rawDecisions.map((decision) => (
    normalizeDecision(decision, resolverView, viability)
  ));
  const seenGoalKeys = new Set();
  for (const decision of decisions) {
    const key = `${characterKey(decision.character)}\u0000${decision.goal_id}`;
    if (existing.unattainableGoals.has(key) || seenGoalKeys.has(key)) {
      const error = new Error(`Phase70B goal ${decision.goal_id} may be marked unattainable only once.`);
      error.code = "WORLD_SIMULATION_GOAL_UNATTAINABILITY_DUPLICATE_FORBIDDEN";
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
    const event = eventFor(
      decision,
      latestByCharacter.get(characterKey(decision.character)) ?? null,
      turnId,
    );
    preview.motivational_goal_unattainability_events = object(
      preview.motivational_goal_unattainability_events,
    );
    if (preview.motivational_goal_unattainability_events[event.goal_unattainability_event_id]) {
      const error = new Error(
        `Phase70B event ${event.goal_unattainability_event_id} already exists.`,
      );
      error.code = "WORLD_SIMULATION_GOAL_UNATTAINABILITY_EVENT_IMMUTABILITY_VIOLATION";
      throw error;
    }
    preview.motivational_goal_unattainability_events[event.goal_unattainability_event_id] =
      cloneJson(event);
    const ref = historyRefFor(event);
    createdEvents.push(event);
    appendedReferences.push(ref);
    latestByCharacter.set(characterKey(event.character), event);
    stateTransitions.push({
      entity: "world",
      field: `motivational_goal_unattainability_events.${event.goal_unattainability_event_id}`,
      from: null,
      to: cloneJson(event),
      cause: `persist immutable MotivationalGoalUnattainabilityEvent ${event.goal_unattainability_event_id}`,
      source_layer: "goal_viability_unattainability_verification",
    });
  }
  if (appendedReferences.length) {
    const nextHistory = [
      ...existing.history.map(cloneJson),
      ...appendedReferences.map(cloneJson),
    ];
    preview.motivational_goal_unattainability_history = nextHistory;
    stateTransitions.push({
      entity: "world",
      field: "motivational_goal_unattainability_history",
      from: cloneJson(worldState.motivational_goal_unattainability_history ?? null),
      to: cloneJson(nextHistory),
      cause: `append ${appendedReferences.length} Phase70B goal-unattainability history reference(s)`,
      source_layer: "goal_viability_unattainability_verification",
    });
  }
  const effectiveViability = projectWorldSimulationEffectiveMotivationalGoalViability({
    world_state: preview,
  });
  if (hashAgentRunValue(inputSnapshot) !== inputHash) {
    const error = new Error("Phase70B goal viability verification mutated its input snapshot.");
    error.code = "WORLD_SIMULATION_GOAL_VIABILITY_INPUT_MUTATED";
    throw error;
  }
  const authoritativeValidationContext = buildAuthoritativeValidationContext(resolverView);
  return deepFreeze({
    ok: true,
    version: worldSimulationGoalViabilityUnattainabilityVersion,
    result: {
      unattainability_decision_count: decisions.length,
      unattainability_events_created: createdEvents,
      history_references_appended: appendedReferences,
      state_transitions: stateTransitions,
      preview_world_state: preview,
      resolver_view_hash: resolverView.resolver_view_hash,
      authoritative_validation_context: authoritativeValidationContext,
      effective_goal_viability_projection: effectiveViability,
      audit: {
        explicit_unattainability_verification: true,
        authoritative_evidence_ref_required: true,
        structural_authoritative_evidence_required: true,
        action_outcome_only_sufficient: false,
        phase62k_validation_context_emitted: true,
        action_failure_alone_sufficient: false,
        plan_failure_alone_sufficient: false,
        lack_of_progress_alone_sufficient: false,
        unattainability_is_abandonment: false,
        automatic_disengagement: false,
        automatic_reengagement: false,
        automatic_replanning: false,
        raw_world_state_scanned: false,
        numeric_scoring_modeled: false,
      },
    },
  });
}
