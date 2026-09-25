import { hashAgentRunValue } from "./agent-run-service.mjs";
import {
  projectWorldSimulationEffectiveMotivationalGoalAdjustment,
} from "./world-simulation-goal-disengagement-reengagement-service.mjs";
import {
  projectWorldSimulationEffectiveGoalImplementationIntentionExecution,
} from "./world-simulation-goal-implementation-intention-execution-feedback-service.mjs";

export const worldSimulationAutonomousCognitionSchedulerVersion =
  "cb-c2-autonomous-cognition-scheduler-v1";
export const worldSimulationAutonomousCognitionOpportunityVersion =
  "cb-c2-autonomous-cognition-opportunity-v1";

const maxCharacters = 256;
const maxEvidencePerCharacter = 24;
const supportedInternalCueKinds = Object.freeze([
  "attention_shift",
  "expectation_violation",
  "memory_reactivation",
  "affective_pressure",
  "relationship_tension",
  "goal_conflict",
  "prospective_rehearsal",
  "unresolved_question",
]);

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function object(value) {
  return isObject(value) ? value : {};
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function optionalString(value, maxLength = 240) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text) return null;
  return text.slice(0, maxLength);
}

function characterKey(value) {
  return String(value ?? "").trim().toLocaleLowerCase("zh-Hant-TW");
}

function sameCharacter(left, right) {
  return characterKey(left) === characterKey(right);
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function runtimeContextFor(runtimeContextByCharacter, character) {
  for (const [name, value] of Object.entries(object(runtimeContextByCharacter))) {
    if (sameCharacter(name, character)) return object(value);
  }
  return {};
}

function recordsForCharacter(byCharacter, character) {
  for (const [name, records] of Object.entries(object(byCharacter))) {
    if (sameCharacter(name, character)) return object(records);
  }
  return {};
}

function stableOpaqueRef(kind, character, source) {
  return `cb_c2_${kind}_${hashAgentRunValue({
    version: worldSimulationAutonomousCognitionSchedulerVersion,
    character: characterKey(character),
    source,
  }).slice(0, 24)}`;
}

function parseTimeMs(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function currentSimulationTime(worldState, input) {
  return input.simulation_time
    ?? worldState.simulation_time
    ?? null;
}

function characterNames(worldState, goalProjection, planProjection, runtimeContextByCharacter) {
  const names = new Map();
  const add = (value) => {
    const name = optionalString(value);
    if (!name) return;
    names.set(characterKey(name), name);
  };
  for (const name of array(worldState.active_characters)) add(name);
  for (const name of Object.keys(object(worldState.characters))) add(name);
  for (const name of Object.keys(object(goalProjection.goals_by_character))) add(name);
  for (const name of Object.keys(object(planProjection.plans_by_character))) add(name);
  for (const name of Object.keys(object(runtimeContextByCharacter))) add(name);
  return [...names.values()]
    .sort((left, right) => characterKey(left).localeCompare(characterKey(right), "zh-Hant-TW"))
    .slice(0, maxCharacters);
}

function activeGoalDescriptors(goalProjection, character) {
  return Object.values(recordsForCharacter(goalProjection.goals_by_character, character))
    .filter((goal) => goal?.state === "committed")
    .filter((goal) => goal?.achieved !== true)
    .filter((goal) => goal?.unattainable !== true)
    .filter((goal) => goal?.disengaged !== true)
    .map((goal) => ({
      goal_ref: stableOpaqueRef("goal", character, {
        goal_id: goal.goal_id,
        state: goal.state,
        achieved: goal.achieved === true,
        unattainable: goal.unattainable === true,
        disengaged: goal.disengaged === true,
      }),
      source_kind: "committed_motivational_goal",
    }));
}

function compatibleLegacyGoal(worldState, character) {
  const state = recordsForCharacter(worldState.characters, character);
  const goal = optionalString(
    state.current_goal
    ?? state.currentGoal
    ?? state.immediate_goal
    ?? state.short_term_goal,
  );
  if (!goal) return null;
  return {
    goal_ref: stableOpaqueRef("compat_goal", character, goal),
    source_kind: "character_state_goal_compatibility",
  };
}

function activePlanDescriptors(planProjection, character) {
  return Object.values(recordsForCharacter(planProjection.plans_by_character, character))
    .filter((plan) => plan?.completed !== true)
    .filter((plan) => ["active", "challenged"].includes(plan?.state))
    .map((plan) => ({
      plan_id: optionalString(plan.implementation_intention_id),
      plan_ref: stableOpaqueRef("plan", character, {
        implementation_intention_id: plan.implementation_intention_id,
        state: plan.state,
        execution_state: plan.execution_state ?? null,
      }),
      state: plan.state,
    }))
    .filter((plan) => plan.plan_id);
}

function explicitInternalEvidence(runtimeContext, character) {
  const evidence = [];
  for (const cue of array(runtimeContext.pending_internal_cues).slice(0, maxEvidencePerCharacter)) {
    if (!isObject(cue)) continue;
    const kind = optionalString(cue.kind, 80);
    const sourceRef = optionalString(cue.source_ref, 240);
    if (!kind || !sourceRef || !supportedInternalCueKinds.includes(kind)) continue;
    evidence.push({
      trigger_kind: kind,
      evidence_ref: stableOpaqueRef(kind, character, sourceRef),
    });
  }
  return evidence;
}

function dueTemporalEvidence(runtimeContext, character, nowMs) {
  if (nowMs === null) return [];
  const evidence = [];
  for (const cue of array(runtimeContext.temporal_cues).slice(0, maxEvidencePerCharacter)) {
    if (!isObject(cue)) continue;
    const sourceRef = optionalString(cue.source_ref, 240);
    const dueAt = cue.due_at ?? cue.due_at_ms;
    const dueMs = parseTimeMs(dueAt);
    if (!sourceRef || dueMs === null || dueMs > nowMs) continue;
    evidence.push({
      trigger_kind: "explicit_temporal_cue_due",
      evidence_ref: stableOpaqueRef("temporal", character, {
        source_ref: sourceRef,
        due_at: dueAt,
      }),
    });
  }
  return evidence;
}

function buildOpportunity({
  character,
  evidence,
  goalRefs,
  planRefs,
}) {
  const sortedEvidence = [...evidence]
    .sort((left, right) => left.trigger_kind.localeCompare(right.trigger_kind, "en")
      || left.evidence_ref.localeCompare(right.evidence_ref, "en"));
  const triggerKinds = [...new Set(sortedEvidence.map((item) => item.trigger_kind))];
  const evidenceRefs = [...new Set(sortedEvidence.map((item) => item.evidence_ref))];
  const opportunityId = `autonomous_cognition_opportunity_${hashAgentRunValue({
    version: worldSimulationAutonomousCognitionOpportunityVersion,
    character: characterKey(character),
    trigger_kinds: triggerKinds,
    evidence_refs: evidenceRefs,
    goal_refs: goalRefs,
    plan_refs: planRefs,
  }).slice(0, 32)}`;
  return {
    version: worldSimulationAutonomousCognitionOpportunityVersion,
    opportunity_id: opportunityId,
    character,
    trigger_kinds: triggerKinds,
    evidence_refs: evidenceRefs,
    goal_refs: [...goalRefs],
    plan_refs: [...planRefs],
    opportunity_only: true,
    thought_content: null,
    belief_revision: null,
    selected_action: null,
    world_mutation: null,
    action_selection_authority: false,
    belief_revision_authority: false,
    thought_content_authority: false,
    world_truth_authority: false,
  };
}

export function buildWorldSimulationAutonomousCognitionSchedulerContract() {
  return deepFreeze({
    version: worldSimulationAutonomousCognitionSchedulerVersion,
    phase: "CB-C2",
    status: "autonomous_cognition_scheduler_foundation_installed",
    trigger_model: "evidence_driven",
    fixed_frequency_polling_is_cognition_trigger: false,
    event_queue_entry_required_for_opportunity: false,
    supported_internal_cue_kinds: [...supportedInternalCueKinds],
    explicit_temporal_cue_supported: true,
    time_passage_alone_triggers_cognition: false,
    committed_goal_idle_trigger_supported: true,
    challenged_plan_trigger_supported: true,
    applicable_plan_cue_trigger_supported: true,
    repeated_unconsumed_evidence_has_stable_opportunity_identity: true,
    consumed_opportunity_suppression_supported: true,
    scheduler_creates_thought_content: false,
    scheduler_revises_beliefs: false,
    scheduler_selects_actions: false,
    scheduler_mutates_world_state: false,
    scheduler_claims_world_truth: false,
    output_is_engine_private_opportunity_evidence: true,
  });
}

export function projectWorldSimulationAutonomousCognitionOpportunities(input = {}) {
  const worldState = cloneJson(object(input.world_state));
  const inputSnapshot = cloneJson(input);
  const runtimeContextByCharacter = cloneJson(object(input.runtime_context_by_character));
  const consumedIds = new Set(
    array(input.consumed_opportunity_ids)
      .map((value) => optionalString(value, 240))
      .filter(Boolean),
  );

  const goalProjection = projectWorldSimulationEffectiveMotivationalGoalAdjustment({
    world_state: worldState,
  });
  const planProjection = projectWorldSimulationEffectiveGoalImplementationIntentionExecution({
    world_state: worldState,
  });
  const now = currentSimulationTime(worldState, input);
  const nowMs = parseTimeMs(now);
  const opportunities = [];

  for (const character of characterNames(
    worldState,
    goalProjection,
    planProjection,
    runtimeContextByCharacter,
  )) {
    const runtimeContext = runtimeContextFor(runtimeContextByCharacter, character);
    const formalGoals = activeGoalDescriptors(goalProjection, character);
    const legacyGoal = compatibleLegacyGoal(worldState, character);
    const goals = formalGoals.length > 0
      ? formalGoals
      : legacyGoal
        ? [legacyGoal]
        : [];
    const plans = activePlanDescriptors(planProjection, character);
    const evidence = [];

    if (runtimeContext.idle === true && goals.length > 0) {
      evidence.push({
        trigger_kind: "idle_with_active_goal",
        evidence_ref: stableOpaqueRef("idle_goal", character, goals.map((goal) => goal.goal_ref)),
      });
    }

    for (const plan of plans) {
      if (plan.state === "challenged") {
        evidence.push({
          trigger_kind: "challenged_implementation_intention",
          evidence_ref: plan.plan_ref,
        });
      }
    }

    const applicablePlanIds = new Set(
      array(runtimeContext.applicable_implementation_intention_ids)
        .map((value) => optionalString(value, 240))
        .filter(Boolean),
    );
    for (const plan of plans) {
      if (applicablePlanIds.has(plan.plan_id)) {
        evidence.push({
          trigger_kind: "implementation_intention_cue_applicable",
          evidence_ref: plan.plan_ref,
        });
      }
    }

    evidence.push(...explicitInternalEvidence(runtimeContext, character));
    evidence.push(...dueTemporalEvidence(runtimeContext, character, nowMs));

    if (evidence.length === 0) continue;
    const opportunity = buildOpportunity({
      character,
      evidence: evidence.slice(0, maxEvidencePerCharacter),
      goalRefs: goals.map((goal) => goal.goal_ref).sort(),
      planRefs: plans.map((plan) => plan.plan_ref).sort(),
    });
    if (consumedIds.has(opportunity.opportunity_id)) continue;
    opportunities.push(opportunity);
  }

  opportunities.sort((left, right) => characterKey(left.character)
    .localeCompare(characterKey(right.character), "zh-Hant-TW")
    || left.opportunity_id.localeCompare(right.opportunity_id, "en"));

  const projection = {
    version: worldSimulationAutonomousCognitionSchedulerVersion,
    simulation_time: cloneJson(now),
    opportunities,
    opportunity_count: opportunities.length,
    trigger_model: "evidence_driven",
    event_queue_entry_required: false,
    fixed_frequency_trigger_used: false,
    time_passage_alone_triggered: false,
    thought_content_created: false,
    belief_revision_performed: false,
    action_selection_performed: false,
    world_mutation_performed: false,
    boundaries: buildWorldSimulationAutonomousCognitionSchedulerContract(),
  };
  projection.projection_hash = hashAgentRunValue(projection);

  if (hashAgentRunValue(input) !== hashAgentRunValue(inputSnapshot)) {
    const error = new Error("CB-C2 scheduler mutated its input.");
    error.code = "WORLD_SIMULATION_AUTONOMOUS_COGNITION_SCHEDULER_INPUT_MUTATED";
    throw error;
  }

  return deepFreeze(projection);
}
