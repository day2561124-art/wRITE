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

export const nativeImplementationIntentionActivationViewVersion =
  "cb-c3-native-implementation-intention-activation-view-v1";
export const nativeImplementationIntentionActivationCapability =
  "implementation_intention_cue_activation_v1";

function assertCanonicalActivationResolverView(raw) {
  const resolverView = cloneJson(object(raw));
  if (resolverView.version !== worldSimulationGoalImplementationIntentionActivationVersion
      || !optionalString(resolverView.resolver_view_hash)
      || hashAgentRunValue(Object.fromEntries(Object.entries(resolverView)
        .filter(([key]) => key !== "resolver_view_hash"))) !== resolverView.resolver_view_hash) {
    const error = new Error("Phase69C activation requires an exact canonical resolver view.");
    error.code = "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_ACTIVATION_RESOLVER_VIEW_INVALID";
    throw error;
  }
  return resolverView;
}

function nativeActivationContext(rawResolverView) {
  const resolverView = assertCanonicalActivationResolverView(rawResolverView);
  const plans = array(resolverView.plans)
    .slice(0, goalImplementationIntentionActivationMaxItems)
    .map((plan) => ({
      plan,
      token: `plan_${hashAgentRunValue({
        version: nativeImplementationIntentionActivationViewVersion,
        resolver_view_hash: resolverView.resolver_view_hash,
        character: resolverView.character,
        plan_ref: plan.plan_ref,
      }).slice(0, 24)}`,
    }));
  const contextToken = `activation_${hashAgentRunValue({
    version: nativeImplementationIntentionActivationViewVersion,
    resolver_view_hash: resolverView.resolver_view_hash,
    character: resolverView.character,
  }).slice(0, 24)}`;
  return { resolverView, plans, contextToken };
}

// CB-C3-E: the Character Brain may judge only whether a bounded prior plan's
// cue applies now. Engine plan refs stay private; Phase69C remains the
// admission authority and the resulting guidance stays advisory to proposer.
export function buildWorldSimulationNativeImplementationIntentionActivationView(input = {}) {
  const { resolverView, plans, contextToken } =
    nativeActivationContext(input.resolver_view);
  return deepFreeze({
    version: nativeImplementationIntentionActivationViewVersion,
    character: resolverView.character,
    context_token: contextToken,
    current_context: cloneJson(resolverView.current_context),
    plans: plans.map(({ plan, token }) => ({
      plan_token: token,
      if_cue: cloneJson(plan.if_cue),
      then_response: cloneJson(plan.then_response),
      reconsideration_state: plan.reconsideration_state,
      subjective_prospective_plan: true,
    })),
    cue_applicability_judgment_only: true,
    action_selection_requested: false,
    causal_outcome_requested: false,
    feasibility_judgment_requested: false,
    world_truth_judgment_requested: false,
    durable_write_requested: false,
    engine_plan_refs_exposed: false,
  });
}

export function resolveWorldSimulationNativeImplementationIntentionActivationIntent(input = {}) {
  const { resolverView, plans, contextToken } =
    nativeActivationContext(input.resolver_view);
  const brainResult = input.brain_result;
  if (!isObject(brainResult) || !Object.hasOwn(brainResult, "activated_plan_tokens")) {
    return deepFreeze({
      version: nativeImplementationIntentionActivationViewVersion,
      character: resolverView.character,
      activated_plan_refs: [],
      explicit_activation_intent_present: false,
      durable_write_performed: false,
      action_selection_authority: false,
      causal_outcome_authority: false,
      world_truth_authority: false,
    });
  }
  if (!Array.isArray(brainResult.activated_plan_tokens)) {
    const error = new Error("CB-C3 native plan activation tokens must be an array.");
    error.code = "WORLD_SIMULATION_NATIVE_PLAN_ACTIVATION_INTENT_INVALID";
    throw error;
  }
  const tokens = brainResult.activated_plan_tokens
    .map((value) => boundedString(value, "activated_plan_token", 160));
  if (tokens.length > goalImplementationIntentionActivationMaxItems) {
    const error = new Error("CB-C3 native plan activation exceeds the bounded plan view.");
    error.code = "WORLD_SIMULATION_NATIVE_PLAN_ACTIVATION_OUT_OF_BOUNDS";
    throw error;
  }
  if (brainResult.plan_activation_context_token !== contextToken) {
    const error = new Error("CB-C3 native plan activation does not pin the exact Phase69C view.");
    error.code = "WORLD_SIMULATION_NATIVE_PLAN_ACTIVATION_CONTEXT_MISMATCH";
    throw error;
  }
  if (new Set(tokens).size !== tokens.length) {
    const error = new Error("CB-C3 native plan activation tokens must be unique.");
    error.code = "WORLD_SIMULATION_NATIVE_PLAN_ACTIVATION_DUPLICATE_TOKEN";
    throw error;
  }
  const planByToken = new Map(plans.map(({ plan, token }) => [token, plan]));
  const activatedPlanRefs = tokens.map((token) => {
    const plan = planByToken.get(token);
    if (!plan) {
      const error = new Error("CB-C3 native plan activation requires a visible plan token.");
      error.code = "WORLD_SIMULATION_NATIVE_PLAN_ACTIVATION_TOKEN_INVALID";
      throw error;
    }
    return plan.plan_ref;
  });
  return deepFreeze({
    version: nativeImplementationIntentionActivationViewVersion,
    character: resolverView.character,
    activated_plan_refs: activatedPlanRefs,
    explicit_activation_intent_present: true,
    durable_write_performed: false,
    action_selection_authority: false,
    causal_outcome_authority: false,
    world_truth_authority: false,
  });
}

export function projectWorldSimulationGoalImplementationIntentionActivation(input = {}) {
  const resolverView = assertCanonicalActivationResolverView(input.resolver_view);
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
