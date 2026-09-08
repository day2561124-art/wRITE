import { hashAgentRunValue } from "./agent-run-service.mjs";
import {
  projectWorldSimulationEffectiveGoalImplementationIntentionExecution,
} from "./world-simulation-goal-implementation-intention-execution-feedback-service.mjs";
import {
  projectWorldSimulationEffectiveMotivationalGoalAdjustment,
} from "./world-simulation-goal-disengagement-reengagement-service.mjs";

export const worldSimulationMeansFeasibilityVersion =
  "phase72-means-feasibility-capability-affordance-v1";
export const meansFeasibilityEventSchemaVersion =
  "phase72-goal-implementation-intention-means-feasibility-event-v1";
export const meansFeasibilityHistoryReferenceSchemaVersion =
  "phase72-goal-implementation-intention-means-feasibility-history-ref-v1";
export const effectiveMeansFeasibilityProjectionVersion =
  "phase72-effective-means-feasibility-projection-v1";

const constraintKinds = Object.freeze(["capability", "resource", "environment", "permission"]);
const constraintStatuses = Object.freeze(["satisfied", "unsatisfied", "unknown"]);
const physicalConstraintKinds = new Set(["capability", "resource", "environment"]);
const maximumEvidenceEntries = 64;
const maximumChecksPerDecision = 24;
const maximumEvidenceRefsPerCheck = 8;
const maximumCharacterVisibleEvidenceRefs = 16;

function isObject(value) { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function object(value) { return isObject(value) ? value : {}; }
function array(value) { return Array.isArray(value) ? value : []; }
function cloneJson(value) { return JSON.parse(JSON.stringify(value ?? null)); }
function optionalString(value) { return typeof value === "string" && value.trim() ? value.trim() : null; }
function boundedString(value, label, maxLength = 240, code = "WORLD_SIMULATION_MEANS_FEASIBILITY_INPUT_INVALID") {
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
function sameCharacter(left, right) { return Boolean(characterKey(left)) && characterKey(left) === characterKey(right); }
function compareText(left, right) { return String(left ?? "").localeCompare(String(right ?? ""), "en"); }
function sameValue(left, right) { return JSON.stringify(left ?? null) === JSON.stringify(right ?? null); }
function hashWithout(value, field) { const body = cloneJson(value); delete body[field]; return hashAgentRunValue(body); }
function meansFeasibilityEventHash(event) { return hashWithout(event, "means_feasibility_event_hash"); }
function findCharacterRecords(container, character) {
  const entry = Object.entries(object(container)).find(([name]) => sameCharacter(name, character));
  return object(entry?.[1]);
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

const privateEvidenceKeys = new Set([
  "world_state", "world_state_patch", "mutation", "mutation_path", "memory_store",
  "hidden_retrieval_graph", "gpt_hidden_reasoning", "internal_chain_of_thought",
]);
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
    if (privateEvidenceKeys.has(String(key).toLowerCase())) continue;
    clean[key] = sanitizeEvidence(child, depth + 1);
  }
  return clean;
}
function evidenceCharacter(value) {
  const evidence = object(value);
  return optionalString(evidence.character ?? evidence.actor ?? evidence.character_name ?? null);
}
function evidenceEntry(turnId, kind, index, evidence) {
  const sanitized = sanitizeEvidence(evidence);
  const evidenceHash = hashAgentRunValue(sanitized);
  const descriptor = {
    evidence_kind: kind,
    evidence_index: index,
    evidence_hash: evidenceHash,
    evidence_character: evidenceCharacter(evidence),
    evidence: sanitized,
  };
  return {
    evidence_ref: `phase72_evidence_${hashAgentRunValue({
      version: worldSimulationMeansFeasibilityVersion,
      turn_id: turnId,
      kind,
      index,
      evidence_hash: evidenceHash,
    }).slice(0, 24)}`,
    ...descriptor,
  };
}
function buildAuthoritativeEvidenceCatalog(input, turnId) {
  const catalog = [];
  const groups = [
    ["selected_action_intent", array(input.selected_action_intents)],
    ["action_outcome", array(input.action_outcomes)],
    ["causal_state_transition", array(input.state_transitions)],
  ];
  for (const [kind, values] of groups) {
    for (let index = 0; index < values.length && catalog.length < maximumEvidenceEntries; index += 1) {
      catalog.push(evidenceEntry(turnId, kind, index, values[index]));
    }
    if (catalog.length >= maximumEvidenceEntries) break;
  }
  return catalog;
}

function eligibleSourcePlans(worldState, turnId) {
  const execution = projectWorldSimulationEffectiveGoalImplementationIntentionExecution({ world_state: worldState });
  const adjustment = projectWorldSimulationEffectiveMotivationalGoalAdjustment({ world_state: worldState });
  const sources = [];
  for (const [character, records] of Object.entries(execution.plans_by_character ?? {})) {
    const goals = findCharacterRecords(adjustment.goals_by_character, character);
    for (const plan of Object.values(object(records))) {
      const goal = goals[plan.goal_id];
      if (!goal
          || goal.state !== "committed"
          || goal.achieved === true
          || goal.unattainable === true
          || goal.disengaged === true
          || !["active", "challenged"].includes(plan.state)
          || plan.completed === true) continue;
      const source = latestPlanSource(worldState, character, plan.implementation_intention_id);
      if (!source) continue;
      const descriptor = {
        character,
        goal_id: plan.goal_id,
        implementation_intention_id: plan.implementation_intention_id,
        target_source_kind: source.target_source_kind,
        target_source_event_id: source.target_source_event_id,
        target_source_event_hash: source.target_source_event_hash,
        cue_descriptor: cloneJson(plan.cue_descriptor),
        response_descriptor: cloneJson(plan.response_descriptor),
        plan_state: plan.state,
        execution_state: plan.execution_state,
        plan_projection_hash: execution.projection_hash,
      };
      sources.push({
        source_plan_ref: `phase72_source_${hashAgentRunValue({
          version: worldSimulationMeansFeasibilityVersion,
          turn_id: turnId,
          descriptor,
        }).slice(0, 24)}`,
        ...descriptor,
      });
    }
  }
  sources.sort((left, right) => compareText(characterKey(left.character), characterKey(right.character))
    || compareText(left.goal_id, right.goal_id)
    || compareText(left.implementation_intention_id, right.implementation_intention_id));
  return sources;
}

export function buildWorldSimulationMeansFeasibilityResolverView(input = {}) {
  const worldState = cloneJson(object(input.world_state));
  const turnId = boundedString(input.turn_id, "turn_id");
  const sourcePlans = eligibleSourcePlans(worldState, turnId);
  const authoritativeEvidence = buildAuthoritativeEvidenceCatalog(input, turnId);
  const view = {
    version: worldSimulationMeansFeasibilityVersion,
    turn_id: turnId,
    source_plans: sourcePlans,
    authoritative_evidence: authoritativeEvidence,
    supported_constraint_kinds: [...constraintKinds],
    supported_constraint_statuses: [...constraintStatuses],
    evaluator_may_return_only_listed_source_plan_refs: true,
    evaluator_may_reference_only_authoritative_evidence_refs: true,
    explicit_cross_character_evidence_forbidden: true,
    complete_coverage_required_to_claim_feasible: true,
    physical_executability_required_to_claim_feasible: true,
    means_blocked_implies_goal_unattainable: false,
    means_blocked_implies_plan_abandonment: false,
    alternative_means_generation_requested: false,
    goal_state_mutation_requested: false,
    plan_lifecycle_mutation_requested: false,
    character_knowledge_update_requested: false,
    raw_world_state_exposed: false,
    raw_memory_store_exposed: false,
    hidden_retrieval_graph_exposed: false,
    numeric_scoring_requested: false,
  };
  view.resolver_view_hash = hashAgentRunValue(view);
  return deepFreeze(view);
}
function authoritativeValidationContext(resolverView) {
  const context = {
    version: worldSimulationMeansFeasibilityVersion,
    turn_id: resolverView.turn_id,
    resolver_view_hash: resolverView.resolver_view_hash,
    source_plans: cloneJson(resolverView.source_plans),
    authoritative_evidence: cloneJson(resolverView.authoritative_evidence),
    bounded_current_turn_engine_evidence_catalog: true,
    complete_coverage_required_to_claim_feasible: true,
    physical_executability_required_to_claim_feasible: true,
    character_visible_evidence_is_explicit_subset_only: true,
    raw_world_state_exposed: false,
  };
  context.context_hash = hashAgentRunValue(context);
  return deepFreeze(context);
}

function normalizeConstraintCheck(raw, source, evidenceByRef, index) {
  if (!isObject(raw)) {
    const error = new Error(`Phase72 constraint check at index ${index} must be an object.`);
    error.code = "WORLD_SIMULATION_MEANS_FEASIBILITY_CONSTRAINT_INVALID";
    throw error;
  }
  const constraintKind = boundedString(raw.constraint_kind, `constraint_checks[${index}].constraint_kind`, 80);
  const constraintStatus = boundedString(raw.constraint_status, `constraint_checks[${index}].constraint_status`, 80);
  const constraintCode = boundedString(raw.constraint_code, `constraint_checks[${index}].constraint_code`, 160);
  if (!constraintKinds.includes(constraintKind) || !constraintStatuses.includes(constraintStatus)) {
    const error = new Error(`Phase72 constraint ${constraintCode} has unsupported kind/status.`);
    error.code = "WORLD_SIMULATION_MEANS_FEASIBILITY_CONSTRAINT_INVALID";
    throw error;
  }
  const evidenceRefs = [...new Set(array(raw.evidence_refs).map((ref, refIndex) =>
    boundedString(ref, `constraint_checks[${index}].evidence_refs[${refIndex}]`, 180)))];
  if (evidenceRefs.length > maximumEvidenceRefsPerCheck
      || (constraintStatus !== "unknown" && evidenceRefs.length < 1)) {
    const error = new Error(`Phase72 constraint ${constraintCode} has invalid evidence coverage.`);
    error.code = "WORLD_SIMULATION_MEANS_FEASIBILITY_CONSTRAINT_EVIDENCE_REQUIRED";
    throw error;
  }
  for (const evidenceRef of evidenceRefs) {
    const evidence = evidenceByRef.get(evidenceRef);
    if (!evidence) {
      const error = new Error(`Phase72 constraint ${constraintCode} references evidence outside the authoritative catalog.`);
      error.code = "WORLD_SIMULATION_MEANS_FEASIBILITY_EVIDENCE_OUT_OF_CONTEXT";
      throw error;
    }
    if (optionalString(evidence.evidence_character)
        && !sameCharacter(evidence.evidence_character, source.character)) {
      const error = new Error(`Phase72 constraint ${constraintCode} references evidence owned by another character.`);
      error.code = "WORLD_SIMULATION_MEANS_FEASIBILITY_CROSS_CHARACTER_EVIDENCE_FORBIDDEN";
      throw error;
    }
  }
  return {
    constraint_kind: constraintKind,
    constraint_code: constraintCode,
    constraint_status: constraintStatus,
    evidence_refs: evidenceRefs.sort(compareText),
    required_for_execution: true,
  };
}
function checkSortKey(check) {
  return JSON.stringify([check.constraint_kind, check.constraint_code, check.constraint_status, check.evidence_refs]);
}
function deriveStatuses(checks, coverageComplete) {
  const unsatisfied = checks.filter((check) => check.constraint_status === "unsatisfied");
  const unknown = checks.filter((check) => check.constraint_status === "unknown");
  const physical = checks.filter((check) => physicalConstraintKinds.has(check.constraint_kind));
  const physicalExecutability = physical.some((check) => check.constraint_status === "unsatisfied")
    ? "blocked"
    : physical.length === 0 || physical.some((check) => check.constraint_status === "unknown")
      ? "indeterminate"
      : "executable";
  const meansStatus = unsatisfied.length > 0
    ? "blocked"
    : coverageComplete === true
        && unknown.length === 0
        && checks.length > 0
        && physicalExecutability !== "indeterminate"
      ? "feasible"
      : "indeterminate";
  const permission = checks.filter((check) => check.constraint_kind === "permission");
  const authorizationStatus = permission.some((check) => check.constraint_status === "unsatisfied")
    ? "denied"
    : permission.length === 0
      ? "not_applicable"
      : permission.some((check) => check.constraint_status === "unknown")
        ? "indeterminate"
        : "authorized";
  return { meansStatus, physicalExecutability, authorizationStatus };
}
function normalizeDecision(raw, resolverView, index) {
  if (!isObject(raw)) {
    const error = new Error(`Phase72 feasibility decision at index ${index} must be an object.`);
    error.code = "WORLD_SIMULATION_MEANS_FEASIBILITY_DECISION_INVALID";
    throw error;
  }
  const sourcePlanRef = boundedString(raw.source_plan_ref, "source_plan_ref", 180);
  const source = resolverView.source_plans.find((entry) => entry.source_plan_ref === sourcePlanRef);
  if (!source) {
    const error = new Error(`Phase72 decision references unknown source plan ${sourcePlanRef}.`);
    error.code = "WORLD_SIMULATION_MEANS_FEASIBILITY_SOURCE_OUT_OF_CONTEXT";
    throw error;
  }
  const rawChecks = array(raw.constraint_checks);
  if (rawChecks.length < 1 || rawChecks.length > maximumChecksPerDecision) {
    const error = new Error(`Phase72 decision for ${sourcePlanRef} requires 1-${maximumChecksPerDecision} constraint checks.`);
    error.code = "WORLD_SIMULATION_MEANS_FEASIBILITY_CONSTRAINT_INVALID";
    throw error;
  }
  const evidenceByRef = new Map(resolverView.authoritative_evidence.map((entry) => [entry.evidence_ref, entry]));
  const checks = rawChecks.map((check, checkIndex) => normalizeConstraintCheck(check, source, evidenceByRef, checkIndex));
  checks.sort((left, right) => compareText(checkSortKey(left), checkSortKey(right)));
  const duplicateKeys = new Set();
  for (const check of checks) {
    const key = `${check.constraint_kind}\u0000${check.constraint_code}`;
    if (duplicateKeys.has(key)) {
      const error = new Error(`Phase72 decision duplicates constraint ${check.constraint_kind}:${check.constraint_code}.`);
      error.code = "WORLD_SIMULATION_MEANS_FEASIBILITY_CONSTRAINT_DUPLICATE";
      throw error;
    }
    duplicateKeys.add(key);
  }
  const coverageComplete = raw.coverage_complete === true;
  const derived = deriveStatuses(checks, coverageComplete);
  const usedEvidenceRefs = new Set(checks.flatMap((check) => check.evidence_refs));
  const visibleRefs = [...new Set(array(raw.character_visible_evidence_refs).map((ref, refIndex) =>
    boundedString(ref, `character_visible_evidence_refs[${refIndex}]`, 180)))].sort(compareText);
  if (visibleRefs.length > maximumCharacterVisibleEvidenceRefs
      || visibleRefs.some((ref) => !usedEvidenceRefs.has(ref))) {
    const error = new Error("Phase72 character-visible evidence must be a bounded subset of evidence actually used by constraint checks.");
    error.code = "WORLD_SIMULATION_MEANS_FEASIBILITY_CHARACTER_VISIBLE_EVIDENCE_INVALID";
    throw error;
  }
  return {
    source,
    constraint_checks: checks,
    coverage_complete: coverageComplete,
    means_status: derived.meansStatus,
    physical_executability: derived.physicalExecutability,
    authorization_status: derived.authorizationStatus,
    character_visible_evidence_refs: visibleRefs,
  };
}

function validateHistory(worldState) {
  const events = object(worldState.goal_implementation_intention_means_feasibility_events);
  const history = array(worldState.goal_implementation_intention_means_feasibility_history);
  const latestByCharacter = new Map();
  const latestByPlan = new Map();
  const seen = new Set();
  const seenPlanTurns = new Set();
  for (const ref of history) {
    const event = object(events[ref?.means_feasibility_event_id]);
    if (!isObject(ref)
        || ref.schema_version !== meansFeasibilityHistoryReferenceSchemaVersion
        || ref.derived_index !== true
        || !optionalString(ref.means_feasibility_event_id)
        || seen.has(ref.means_feasibility_event_id)
        || !Object.keys(event).length
        || event.schema_version !== meansFeasibilityEventSchemaVersion
        || event.version !== worldSimulationMeansFeasibilityVersion
        || event.immutable !== true
        || event.means_feasibility_event_id !== ref.means_feasibility_event_id
        || meansFeasibilityEventHash(event) !== event.means_feasibility_event_hash
        || ref.means_feasibility_event_hash !== event.means_feasibility_event_hash
        || ref.character !== event.character
        || ref.source_turn_id !== event.source_turn_id
        || ref.goal_id !== event.goal_id
        || ref.implementation_intention_id !== event.implementation_intention_id
        || ref.means_status !== event.means_status
        || ref.previous_means_feasibility_event_id !== event.previous_means_feasibility_event_id
        || ref.previous_means_feasibility_event_hash !== event.previous_means_feasibility_event_hash) {
      const error = new Error("Phase72 means-feasibility history contains an invalid reference/event pair.");
      error.code = "WORLD_SIMULATION_MEANS_FEASIBILITY_HISTORY_REFERENCE_INVALID";
      throw error;
    }
    const key = characterKey(event.character);
    const previous = latestByCharacter.get(key) ?? null;
    const planTurnKey = `${key}\u0000${event.implementation_intention_id}\u0000${event.source_turn_id}`;
    if (event.previous_means_feasibility_event_id !== (previous?.means_feasibility_event_id ?? null)
        || event.previous_means_feasibility_event_hash !== (previous?.means_feasibility_event_hash ?? null)
        || seenPlanTurns.has(planTurnKey)) {
      const error = new Error(`Phase72 event ${event.means_feasibility_event_id} breaks its chain or duplicates a plan/turn evaluation.`);
      error.code = "WORLD_SIMULATION_MEANS_FEASIBILITY_EVENT_CHAIN_INVALID";
      throw error;
    }
    seen.add(event.means_feasibility_event_id);
    seenPlanTurns.add(planTurnKey);
    latestByCharacter.set(key, event);
    latestByPlan.set(`${key}\u0000${event.implementation_intention_id}`, event);
  }
  return { events, history, latestByCharacter, latestByPlan, seen, seenPlanTurns };
}
function eventFor(decision, previous, turnId, resolverView) {
  const source = decision.source;
  const base = {
    schema_version: meansFeasibilityEventSchemaVersion,
    version: worldSimulationMeansFeasibilityVersion,
    immutable: true,
    character: source.character,
    source_turn_id: turnId,
    operation: "verify_means_feasibility",
    goal_id: source.goal_id,
    source_plan_ref: source.source_plan_ref,
    implementation_intention_id: source.implementation_intention_id,
    target_source_kind: source.target_source_kind,
    target_source_event_id: source.target_source_event_id,
    target_source_event_hash: source.target_source_event_hash,
    cue_descriptor: cloneJson(source.cue_descriptor),
    response_descriptor: cloneJson(source.response_descriptor),
    source_plan_projection_hash: source.plan_projection_hash,
    constraint_checks: cloneJson(decision.constraint_checks),
    coverage_complete: decision.coverage_complete,
    means_status: decision.means_status,
    physical_executability: decision.physical_executability,
    authorization_status: decision.authorization_status,
    authoritative_evidence_catalog_hash: hashAgentRunValue(resolverView.authoritative_evidence),
    character_visible_evidence_refs: cloneJson(decision.character_visible_evidence_refs),
    resolver_view_hash: resolverView.resolver_view_hash,
    previous_means_feasibility_event_id: previous?.means_feasibility_event_id ?? null,
    previous_means_feasibility_event_hash: previous?.means_feasibility_event_hash ?? null,
    engine_authoritative_constraint_validation: true,
    world_truth_is_not_character_knowledge: true,
    character_knowledge_updated: false,
    character_visible_evidence_subset_only: true,
    means_blocked_implies_goal_unattainable: false,
    means_blocked_implies_plan_abandonment: false,
    alternative_means_generated: false,
    goal_state_mutated: false,
    plan_lifecycle_mutated: false,
    same_turn_replanning_triggered: false,
    arbitrary_world_state_search_used: false,
    utility_score: null,
    success_probability: null,
    feasibility_score: null,
    character_brain_direct_write: false,
    status: "goal_implementation_intention_means_feasibility_recorded",
  };
  const eventId = `goal_implementation_intention_means_feasibility_event_${hashAgentRunValue({
    version: worldSimulationMeansFeasibilityVersion,
    character: characterKey(source.character),
    source_turn_id: turnId,
    implementation_intention_id: source.implementation_intention_id,
    constraint_checks: decision.constraint_checks,
    coverage_complete: decision.coverage_complete,
    previous_means_feasibility_event_hash: previous?.means_feasibility_event_hash ?? null,
  }).slice(0, 24)}`;
  const event = { ...base, means_feasibility_event_id: eventId };
  event.means_feasibility_event_hash = meansFeasibilityEventHash(event);
  return deepFreeze(event);
}
function historyRefFor(event) {
  return deepFreeze({
    schema_version: meansFeasibilityHistoryReferenceSchemaVersion,
    derived_index: true,
    means_feasibility_event_id: event.means_feasibility_event_id,
    means_feasibility_event_hash: event.means_feasibility_event_hash,
    character: event.character,
    source_turn_id: event.source_turn_id,
    goal_id: event.goal_id,
    implementation_intention_id: event.implementation_intention_id,
    means_status: event.means_status,
    previous_means_feasibility_event_id: event.previous_means_feasibility_event_id,
    previous_means_feasibility_event_hash: event.previous_means_feasibility_event_hash,
    status: event.status,
  });
}

export function projectWorldSimulationEffectiveMeansFeasibility(input = {}) {
  const worldState = cloneJson(object(input.world_state));
  const replay = validateHistory(worldState);
  const latestByCharacter = {};
  for (const event of replay.latestByPlan.values()) {
    latestByCharacter[event.character] ??= {};
    latestByCharacter[event.character][event.implementation_intention_id] = {
      goal_id: event.goal_id,
      means_status: event.means_status,
      physical_executability: event.physical_executability,
      authorization_status: event.authorization_status,
      coverage_complete: event.coverage_complete,
      source_turn_id: event.source_turn_id,
      means_feasibility_event_id: event.means_feasibility_event_id,
      means_feasibility_event_hash: event.means_feasibility_event_hash,
    };
  }
  const projection = {
    version: effectiveMeansFeasibilityProjectionVersion,
    latest_by_character: latestByCharacter,
    feasibility_history_hash: hashAgentRunValue(replay.history),
    replayed_feasibility_event_count: replay.history.length,
    replayable_projection: true,
    means_blocked_implies_goal_unattainable: false,
    world_truth_is_not_character_knowledge: true,
    numeric_scoring_modeled: false,
  };
  projection.projection_hash = hashAgentRunValue(projection);
  return deepFreeze(projection);
}

export function buildWorldSimulationMeansFeasibilityContract() {
  return deepFreeze({
    version: worldSimulationMeansFeasibilityVersion,
    phase: "Phase72",
    status: "engine_authoritative_means_feasibility_capability_affordance_validation_installed",
    supported_constraint_kinds: [...constraintKinds],
    supported_constraint_statuses: [...constraintStatuses],
    bounded_current_turn_engine_evidence_catalog_required: true,
    canonical_source_plan_membership_required: true,
    complete_coverage_required_to_claim_feasible: true,
    physical_executability_required_to_claim_feasible: true,
    physical_executability_separate_from_authorization: true,
    indeterminate_is_not_blocked: true,
    means_blocked_implies_goal_unattainable: false,
    means_blocked_implies_plan_abandonment: false,
    alternative_means_generation_modeled: false,
    automatic_same_turn_replanning_modeled: false,
    character_visible_evidence_explicit_subset_only: true,
    engine_world_truth_auto_updates_character_knowledge: false,
    immutable_feasibility_event_write_once_required: true,
    append_only_feasibility_history_required: true,
    per_character_previous_event_hash_chain_required: true,
    repeated_evaluation_on_later_turns_allowed: true,
    numeric_utility_probability_feasibility_score_modeled: false,
    authoritative_mutation_owner: "phase62k-authoritative-mutation-executor-v1",
    deterministic_replay_required: true,
    input_immutability_required: true,
  });
}

export function buildWorldSimulationMeansFeasibilityEvents(input = {}) {
  const worldState = cloneJson(object(input.world_state));
  const turnId = boundedString(input.turn_id, "turn_id");
  const resolverView = input.resolver_view
    ? cloneJson(input.resolver_view)
    : buildWorldSimulationMeansFeasibilityResolverView({
      world_state: worldState,
      turn_id: turnId,
      selected_action_intents: input.selected_action_intents,
      action_outcomes: input.action_outcomes,
      state_transitions: input.state_transitions,
    });
  const canonicalHash = hashAgentRunValue(Object.fromEntries(
    Object.entries(resolverView).filter(([key]) => key !== "resolver_view_hash"),
  ));
  if (resolverView.version !== worldSimulationMeansFeasibilityVersion
      || resolverView.turn_id !== turnId
      || canonicalHash !== resolverView.resolver_view_hash) {
    const error = new Error("Phase72 requires an exact canonical means-feasibility resolver view.");
    error.code = "WORLD_SIMULATION_MEANS_FEASIBILITY_RESOLVER_VIEW_INVALID";
    throw error;
  }
  const decisions = array(input.feasibility_decisions).map((decision, index) =>
    normalizeDecision(decision, resolverView, index));
  const seenPlanRefs = new Set();
  for (const decision of decisions) {
    if (seenPlanRefs.has(decision.source.source_plan_ref)) {
      const error = new Error(`Phase72 allows at most one feasibility decision per source plan per turn: ${decision.source.source_plan_ref}.`);
      error.code = "WORLD_SIMULATION_MEANS_FEASIBILITY_PER_PLAN_TURN_LIMIT";
      throw error;
    }
    seenPlanRefs.add(decision.source.source_plan_ref);
  }
  const canonicalSources = eligibleSourcePlans(worldState, turnId);
  for (const decision of decisions) {
    const canonical = canonicalSources.find((entry) => entry.source_plan_ref === decision.source.source_plan_ref);
    if (!canonical || !sameValue(canonical, decision.source)) {
      const error = new Error(`Phase72 source ${decision.source.source_plan_ref} became stale before persistence.`);
      error.code = "WORLD_SIMULATION_MEANS_FEASIBILITY_SOURCE_INVALID";
      throw error;
    }
  }
  const replay = validateHistory(worldState);
  const preview = cloneJson(worldState);
  const latestByCharacter = new Map(replay.latestByCharacter);
  const createdEvents = [];
  const appendedReferences = [];
  const stateTransitions = [];
  for (const decision of decisions) {
    const key = characterKey(decision.source.character);
    const planTurnKey = `${key}\u0000${decision.source.implementation_intention_id}\u0000${turnId}`;
    if (replay.seenPlanTurns.has(planTurnKey)) {
      const error = new Error(`Phase72 plan ${decision.source.implementation_intention_id} already has a feasibility event for ${turnId}.`);
      error.code = "WORLD_SIMULATION_MEANS_FEASIBILITY_PER_PLAN_TURN_LIMIT";
      throw error;
    }
    const event = eventFor(decision, latestByCharacter.get(key) ?? null, turnId, resolverView);
    preview.goal_implementation_intention_means_feasibility_events = object(
      preview.goal_implementation_intention_means_feasibility_events,
    );
    if (preview.goal_implementation_intention_means_feasibility_events[event.means_feasibility_event_id]) {
      const error = new Error(`Phase72 event ${event.means_feasibility_event_id} already exists.`);
      error.code = "WORLD_SIMULATION_MEANS_FEASIBILITY_EVENT_IMMUTABILITY_VIOLATION";
      throw error;
    }
    preview.goal_implementation_intention_means_feasibility_events[event.means_feasibility_event_id] = cloneJson(event);
    const ref = historyRefFor(event);
    createdEvents.push(event);
    appendedReferences.push(ref);
    latestByCharacter.set(key, event);
    stateTransitions.push({
      entity: "world",
      field: `goal_implementation_intention_means_feasibility_events.${event.means_feasibility_event_id}`,
      from: null,
      to: cloneJson(event),
      cause: `persist immutable Phase72 MeansFeasibilityEvent ${event.means_feasibility_event_id}`,
      source_layer: "means_feasibility_capability_affordance",
    });
  }
  if (appendedReferences.length) {
    const nextHistory = [...replay.history.map(cloneJson), ...appendedReferences.map(cloneJson)];
    preview.goal_implementation_intention_means_feasibility_history = nextHistory;
    stateTransitions.push({
      entity: "world",
      field: "goal_implementation_intention_means_feasibility_history",
      from: cloneJson(worldState.goal_implementation_intention_means_feasibility_history ?? null),
      to: cloneJson(nextHistory),
      cause: `append ${appendedReferences.length} Phase72 means-feasibility history reference(s)`,
      source_layer: "means_feasibility_capability_affordance",
    });
  }
  return deepFreeze({
    ok: true,
    version: worldSimulationMeansFeasibilityVersion,
    result: {
      feasibility_decision_count: decisions.length,
      means_feasibility_events_created: createdEvents,
      history_references_appended: appendedReferences,
      state_transitions: stateTransitions,
      preview_world_state: preview,
      resolver_view_hash: resolverView.resolver_view_hash,
      authoritative_validation_context: authoritativeValidationContext(resolverView),
      effective_means_feasibility_projection: projectWorldSimulationEffectiveMeansFeasibility({ world_state: preview }),
      audit: {
        engine_authoritative_constraint_validation: true,
        bounded_current_turn_engine_evidence_catalog: true,
        complete_coverage_required_to_claim_feasible: true,
        physical_executability_required_to_claim_feasible: true,
        physical_executability_separate_from_authorization: true,
        means_blocked_implies_goal_unattainable: false,
        means_blocked_implies_plan_abandonment: false,
        alternative_means_generated: false,
        same_turn_replanning_triggered: false,
        character_knowledge_updated: false,
        character_visible_evidence_subset_only: true,
        arbitrary_world_state_search_used: false,
        numeric_scoring_modeled: false,
      },
    },
  });
}
