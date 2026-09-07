import { hashAgentRunValue } from "./agent-run-service.mjs";
import {
  projectWorldSimulationEffectiveRevisedGoalImplementationIntentions,
  projectWorldSimulationRevisedGoalImplementationIntentionsForCharacter,
} from "./world-simulation-goal-implementation-intention-revision-service.mjs";
import { projectWorldSimulationEffectiveGoalImplementationIntentionExecution } from "./world-simulation-goal-implementation-intention-execution-feedback-service.mjs";

export const worldSimulationGoalImplementationIntentionActivationVersion = "phase69c-goal-implementation-intention-activation-v1";
export const goalImplementationIntentionActivationProjectionVersion = "phase69c-implementation-intention-activation-projection-v1";
export const goalImplementationIntentionActivationMaxItems = 8;

function isObject(value) { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function object(value) { return isObject(value) ? value : {}; }
function array(value) { return Array.isArray(value) ? value : []; }
function cloneJson(value) { return JSON.parse(JSON.stringify(value ?? null)); }
function optionalString(value) { return typeof value === "string" && value.trim() ? value.trim() : null; }
function boundedString(value, label, maxLength = 240) {
  const text = optionalString(value);
  if (!text || text.length > maxLength) {
    const error = new Error(`${label} must be a non-empty string no longer than ${maxLength} characters.`);
    error.code = "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_ACTIVATION_INPUT_INVALID";
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
function forbiddenKey(key) {
  const text = String(key ?? "").toLowerCase();
  return text === "world_state" || text === "raw_world_event" || text === "memory_store"
    || text === "hidden_retrieval_graph" || text === "mutation" || text === "mutation_path"
    || text === "world_state_patch" || text === "outcome" || text === "action_id"
    || text === "utility" || text === "priority" || text === "probability"
    || text === "confidence" || text === "feasibility_score" || text.endsWith("_hash")
    || text.endsWith("_id") || text.endsWith("_ids") || text.startsWith("engine_");
}
function sanitizeBoundedContext(value, depth = 0) {
  if (depth > 8) return null;
  if (Array.isArray(value)) return value.slice(0, 64).map((item) => sanitizeBoundedContext(item, depth + 1));
  if (!isObject(value)) {
    if (typeof value === "string") return value.slice(0, 1200);
    if (typeof value === "number" || typeof value === "boolean" || value == null) return value;
    return null;
  }
  const clean = {};
  for (const [key, child] of Object.entries(value).slice(0, 96)) {
    if (forbiddenKey(key)) continue;
    clean[key] = sanitizeBoundedContext(child, depth + 1);
  }
  return clean;
}

export function buildWorldSimulationGoalImplementationIntentionActivationContract() {
  return deepFreeze({
    version: worldSimulationGoalImplementationIntentionActivationVersion,
    phase: "Phase69C",
    status: "plan_cue_activation_action_guidance_installed",
    read_only_projection_only: true,
    durable_state_created: false,
    committed_prior_turn_plans_only: true,
    active_or_challenged_plans_only: true,
    opaque_plan_refs_at_resolver_boundary: true,
    raw_world_state_exposed: false,
    raw_world_event_exposed: false,
    raw_memory_store_exposed: false,
    hidden_retrieval_graph_exposed: false,
    executable_action_ids_exposed: false,
    action_selection_authority_claimed: false,
    causal_outcome_authority_claimed: false,
    feasibility_or_world_truth_oracle_claimed: false,
    numeric_activation_utility_priority_probability_confidence_modeled: false,
    missing_resolver_means_no_activation: true,
    same_turn_feedback_allowed: false,
    deterministic_projection_required: true,
    input_immutability_required: true,
  });
}

export function buildWorldSimulationGoalImplementationIntentionActivationResolverView(input = {}) {
  const worldState = cloneJson(object(input.world_state));
  const character = boundedString(input.character, "character");
  const currentTurnId = boundedString(input.current_turn_id, "current_turn_id");
  // Preserve Phase69B's prior-turn contamination guard, then rebuild the
  // bounded plan list from the effective Phase69D execution projection so
  // explicitly completed plans are prospectively inactive without deleting
  // their historical cue-response association.
  projectWorldSimulationRevisedGoalImplementationIntentionsForCharacter({
    world_state: worldState,
    character,
    current_turn_id: currentTurnId,
  });
  const effectiveRevision = projectWorldSimulationEffectiveRevisedGoalImplementationIntentions({ world_state: worldState });
  const effectiveExecution = projectWorldSimulationEffectiveGoalImplementationIntentionExecution({ world_state: worldState });
  const revisionRecords = Object.entries(effectiveRevision.plans_by_character ?? {})
    .find(([name]) => String(name).trim().toLocaleLowerCase("zh-Hant-TW") === character.toLocaleLowerCase("zh-Hant-TW"))?.[1] ?? {};
  const executionRecords = Object.entries(effectiveExecution.plans_by_character ?? {})
    .find(([name]) => String(name).trim().toLocaleLowerCase("zh-Hant-TW") === character.toLocaleLowerCase("zh-Hant-TW"))?.[1] ?? {};
  const currentContext = sanitizeBoundedContext(object(input.current_context));
  const eligiblePlans = Object.values(object(revisionRecords))
    .filter((plan) => ["active", "challenged"].includes(plan.state))
    .filter((plan) => executionRecords[plan.implementation_intention_id]?.completed !== true)
    .sort((left, right) => Number(right.latest_history_index ?? 0) - Number(left.latest_history_index ?? 0)
      || String(left.implementation_intention_id).localeCompare(String(right.implementation_intention_id), "en"))
    .slice(0, goalImplementationIntentionActivationMaxItems);
  const plans = eligiblePlans.map((plan, index) => ({
    plan_ref: `phase69c_plan_${hashAgentRunValue({
      version: worldSimulationGoalImplementationIntentionActivationVersion,
      character: character.toLocaleLowerCase("zh-Hant-TW"),
      current_turn_id: currentTurnId,
      index,
      implementation_intention_id: plan.implementation_intention_id,
      cue_descriptor: plan.cue_descriptor,
      response_descriptor: plan.response_descriptor,
      reconsideration_state: plan.state,
    }).slice(0, 24)}`,
    if_cue: cloneJson(plan.cue_descriptor),
    then_response: cloneJson(plan.response_descriptor),
    reconsideration_state: plan.state,
    subjective_prospective_plan: true,
  }));
  const view = {
    version: worldSimulationGoalImplementationIntentionActivationVersion,
    character,
    current_context: currentContext,
    plans,
    resolver_may_return_only_plan_refs: true,
    unknown_or_duplicate_plan_refs_rejected: true,
    action_selection_requested: false,
    causal_outcome_requested: false,
    feasibility_judgment_requested: false,
    world_truth_judgment_requested: false,
    numeric_scoring_requested: false,
    raw_world_state_exposed: false,
    raw_world_event_exposed: false,
    raw_memory_store_exposed: false,
    hidden_retrieval_graph_exposed: false,
    executable_action_ids_exposed: false,
  };
  view.resolver_view_hash = hashAgentRunValue(view);
  return deepFreeze(view);
}

export function projectWorldSimulationGoalImplementationIntentionActivation(input = {}) {
  const resolverView = cloneJson(object(input.resolver_view));
  if (resolverView.version !== worldSimulationGoalImplementationIntentionActivationVersion
      || !optionalString(resolverView.resolver_view_hash)
      || hashAgentRunValue(Object.fromEntries(Object.entries(resolverView).filter(([key]) => key !== "resolver_view_hash"))) !== resolverView.resolver_view_hash) {
    const error = new Error("Phase69C activation requires an exact canonical resolver view.");
    error.code = "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_ACTIVATION_RESOLVER_VIEW_INVALID";
    throw error;
  }
  const planByRef = new Map(array(resolverView.plans).map((plan) => [plan.plan_ref, plan]));
  const activatedRefs = array(input.activated_plan_refs).map((value) => boundedString(value, "activated_plan_ref", 160));
  if (new Set(activatedRefs).size !== activatedRefs.length) {
    const error = new Error("Phase69C activation refs must be unique.");
    error.code = "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_ACTIVATION_DUPLICATE_REF";
    throw error;
  }
  const activated = activatedRefs.map((ref) => {
    const plan = planByRef.get(ref);
    if (!plan) {
      const error = new Error(`Unknown Phase69C activation plan ref ${ref}.`);
      error.code = "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_ACTIVATION_UNKNOWN_REF";
      throw error;
    }
    return {
      if_cue: cloneJson(plan.if_cue),
      then_response: cloneJson(plan.then_response),
      reconsideration_state: plan.reconsideration_state,
      cue_applicable: true,
      advisory_only: true,
      selected_action_authority: false,
      executable_action_id: null,
    };
  });
  const projection = {
    version: goalImplementationIntentionActivationProjectionVersion,
    source_version: worldSimulationGoalImplementationIntentionActivationVersion,
    source_resolver_view_hash: resolverView.resolver_view_hash,
    implementation_intention_guidance: activated,
    activated_plan_count: activated.length,
    advisory_only: true,
    action_selection_authority_claimed: false,
    causal_outcome_authority_claimed: false,
    feasibility_or_world_truth_authority_claimed: false,
    numeric_activation_utility_priority_probability_confidence_modeled: false,
    engine_plan_refs_exposed_downstream: false,
  };
  projection.projection_hash = hashAgentRunValue(projection);
  return deepFreeze(projection);
}
