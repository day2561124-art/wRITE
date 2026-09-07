import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import {
  buildWorldSimulationChronologicalMutationQueue,
  executeWorldSimulationChronologicalMutationQueue,
} from "../../server/src/world-simulation-chronological-mutation-queue-service.mjs";
import {
  motivationalGoalEventSchemaVersion,
  motivationalGoalHistoryReferenceSchemaVersion,
  worldSimulationMotivationGoalIntegrationVersion,
} from "../../server/src/world-simulation-motivation-goal-integration-service.mjs";
import {
  buildWorldSimulationGoalImplementationIntentionEvents,
  buildWorldSimulationGoalImplementationIntentionResolverView,
} from "../../server/src/world-simulation-goal-to-plan-implementation-intention-service.mjs";
import {
  buildWorldSimulationGoalImplementationIntentionActivationResolverView,
} from "../../server/src/world-simulation-goal-implementation-intention-activation-service.mjs";
import {
  buildWorldSimulationGoalImplementationIntentionExecutionFeedback,
  buildWorldSimulationGoalImplementationIntentionExecutionFeedbackContract,
  buildWorldSimulationGoalImplementationIntentionExecutionFeedbackResolverView,
  projectWorldSimulationEffectiveGoalImplementationIntentionExecution,
  worldSimulationGoalImplementationIntentionExecutionFeedbackVersion,
} from "../../server/src/world-simulation-goal-implementation-intention-execution-feedback-service.mjs";

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function goalHash(event) { const body = clone(event); delete body.goal_event_hash; return hashAgentRunValue(body); }
function goalRef(event) {
  return {
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
  };
}
function makeGoalEvent({ character, goalId, turnId, operation, previous = null }) {
  const event = {
    schema_version: motivationalGoalEventSchemaVersion,
    version: worldSimulationMotivationGoalIntegrationVersion,
    immutable: true,
    character,
    source_turn_id: turnId,
    operation,
    goal_id: goalId,
    goal_kind: "maintain_state",
    domain: "relationships",
    target_descriptor: { label: "keep_companions_safe", context: "academy_conflict" },
    motivation_basis_refs: [{
      source_kind: "phase68b_structured_self_model_aspect_event",
      source_event_id: "self_aspect_source_69d",
      source_event_hash: "self_aspect_hash_69d",
    }],
    motivation_relations: ["self_concordant_with"],
    resolver_view_hash: `goal_resolver_${turnId}`,
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
    goal_event_id: `goal_event_${turnId}`,
  };
  event.goal_event_hash = goalHash(event);
  return event;
}
function executeBuilt(world, turnId, layer, built) {
  const queue = buildWorldSimulationChronologicalMutationQueue({
    turn_id: `${turnId}:${layer}`,
    world_state_hash: hashAgentRunValue(world),
    state_transitions: built.result.state_transitions,
    elapsed_ms: 0,
  });
  return executeWorldSimulationChronologicalMutationQueue({
    world_state: world,
    preview_world_state: built.result.preview_world_state,
    queue,
  }).next_world_state;
}
function feedback(world, turnId, selectedAction, actionOutcome, operation) {
  const resolverView = buildWorldSimulationGoalImplementationIntentionExecutionFeedbackResolverView({
    world_state: world,
    turn_id: turnId,
    selected_action_intents: [selectedAction],
    action_outcomes: [actionOutcome],
  });
  assert.equal(resolverView.plans.length, 1);
  const built = buildWorldSimulationGoalImplementationIntentionExecutionFeedback({
    world_state: world,
    turn_id: turnId,
    resolver_view: resolverView,
    feedback_decisions: [{
      plan_ref: resolverView.plans[0].plan_ref,
      operation,
    }],
  });
  return { resolverView, built, world: executeBuilt(world, turnId, "goal_implementation_intention_execution_feedback", built) };
}

const elias = "伊萊亞斯・諾爾";
const goalId = "motivational_goal_phase69d_committed_001";
const proposed = makeGoalEvent({ character: elias, goalId, turnId: "world_turn_phase69d_goal_001", operation: "propose" });
const committed = makeGoalEvent({ character: elias, goalId, turnId: "world_turn_phase69d_goal_002", operation: "commit", previous: proposed });
let world = {
  motivational_goal_events: {
    [proposed.goal_event_id]: proposed,
    [committed.goal_event_id]: committed,
  },
  motivational_goal_history: [goalRef(proposed), goalRef(committed)],
};

const planTurn = "world_turn_phase69d_plan_001";
const planResolver = buildWorldSimulationGoalImplementationIntentionResolverView({ world_state: world, turn_id: planTurn });
const formed = buildWorldSimulationGoalImplementationIntentionEvents({
  world_state: world,
  turn_id: planTurn,
  implementation_intention_decisions: [{
    character: elias,
    goal_id: goalId,
    cue_descriptor: { cue_kind: "obstacle", label: "companion_is_threatened", context: "academy_conflict" },
    response_descriptor: { response_kind: "seek_support", label: "coordinate_with_nearby_ally", context: "planning_only" },
    resolver_view_hash: planResolver.resolver_view_hash,
  }],
});
world = executeBuilt(world, planTurn, "goal_implementation_intention", formed);
const plan = formed.result.implementation_intention_events_created[0];

const contract = buildWorldSimulationGoalImplementationIntentionExecutionFeedbackContract();
assert.equal(contract.phase, "Phase69D");
assert.deepEqual(contract.supported_operations, ["attempted", "fulfilled", "failed", "completed"]);
assert.equal(contract.action_success_implies_plan_completion, false);
assert.equal(contract.plan_completion_implies_goal_achievement, false);
assert.equal(contract.goal_achievement_authority_claimed, false);
assert.equal(contract.authoritative_mutation_owner, "phase62k-authoritative-mutation-executor-v1");

const selectedAttempt = { character: elias, action_id: "coordinate_attempt_001", intent: "coordinate_with_nearby_ally" };
const successfulOutcome = { actor: elias, action_id: "coordinate_attempt_001", result: "coordination_succeeded", causal_evidence: "ally acknowledged request" };
const attempted = feedback(world, "world_turn_phase69d_feedback_001", selectedAttempt, successfulOutcome, "attempted");
assert.equal(attempted.resolverView.version, worldSimulationGoalImplementationIntentionExecutionFeedbackVersion);
assert.equal(attempted.resolverView.action_success_implies_plan_completion, false);
world = attempted.world;
let projected = projectWorldSimulationEffectiveGoalImplementationIntentionExecution({ world_state: world });
let effectivePlan = projected.plans_by_character[elias][plan.implementation_intention_id];
assert.equal(effectivePlan.execution_state, "attempted");
assert.equal(effectivePlan.completed, false, "A successful action outcome must not implicitly complete the plan.");
assert.equal(world.motivational_goal_events[committed.goal_event_id].operation, "commit");

const fulfilled = feedback(
  world,
  "world_turn_phase69d_feedback_002",
  { character: elias, action_id: "coordinate_attempt_002", intent: "coordinate_with_nearby_ally" },
  { actor: elias, action_id: "coordinate_attempt_002", result: "response_condition_fulfilled", causal_evidence: "ally provided cover" },
  "fulfilled",
);
world = fulfilled.world;
projected = projectWorldSimulationEffectiveGoalImplementationIntentionExecution({ world_state: world });
effectivePlan = projected.plans_by_character[elias][plan.implementation_intention_id];
assert.equal(effectivePlan.execution_state, "fulfilled");
assert.equal(effectivePlan.completed, false, "Fulfillment is not itself an implicit deactivation event.");

const activationBeforeCompletion = buildWorldSimulationGoalImplementationIntentionActivationResolverView({
  world_state: world,
  character: elias,
  current_turn_id: "world_turn_phase69d_activation_before_completion",
  current_context: {},
});
assert.equal(activationBeforeCompletion.plans.length, 1, "Fulfilled but not completed plans remain prospectively active.");

const completedResolver = buildWorldSimulationGoalImplementationIntentionExecutionFeedbackResolverView({
  world_state: world,
  turn_id: "world_turn_phase69d_feedback_003",
  selected_action_intents: [{ character: elias, action_id: "coordinate_attempt_003", intent: "coordinate_with_nearby_ally" }],
  action_outcomes: [{ actor: elias, action_id: "coordinate_attempt_003", result: "coordination_succeeded", causal_evidence: "coordination loop closed" }],
});
const staleCompletedResolver = clone(completedResolver);
const completedBuilt = buildWorldSimulationGoalImplementationIntentionExecutionFeedback({
  world_state: world,
  turn_id: "world_turn_phase69d_feedback_003",
  resolver_view: completedResolver,
  feedback_decisions: [{ plan_ref: completedResolver.plans[0].plan_ref, operation: "completed" }],
});
world = executeBuilt(world, "world_turn_phase69d_feedback_003", "goal_implementation_intention_execution_feedback", completedBuilt);
projected = projectWorldSimulationEffectiveGoalImplementationIntentionExecution({ world_state: world });
effectivePlan = projected.plans_by_character[elias][plan.implementation_intention_id];
assert.equal(effectivePlan.execution_state, "completed");
assert.equal(effectivePlan.completed, true);
assert.ok(world.goal_implementation_intention_events[plan.implementation_intention_event_id], "Completion must not delete the original cue-response plan event.");
assert.ok(world.goal_implementation_intention_history.some((ref) => ref.implementation_intention_id === plan.implementation_intention_id));
assert.equal(world.motivational_goal_events[committed.goal_event_id].operation, "commit", "Plan completion must not mutate the source goal into achieved/completed state.");

const activationAfterCompletion = buildWorldSimulationGoalImplementationIntentionActivationResolverView({
  world_state: world,
  character: elias,
  current_turn_id: "world_turn_phase69d_activation_after_completion",
  current_context: {},
});
assert.equal(activationAfterCompletion.plans.length, 0, "Explicitly completed plans must not reactivate in Phase69C.");

assert.throws(
  () => buildWorldSimulationGoalImplementationIntentionExecutionFeedback({
    world_state: world,
    turn_id: "world_turn_phase69d_feedback_003",
    resolver_view: staleCompletedResolver,
    feedback_decisions: [{ plan_ref: staleCompletedResolver.plans[0].plan_ref, operation: "attempted" }],
  }),
  (error) => error?.code === "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_EXECUTION_FEEDBACK_TARGET_INVALID",
  "No feedback may be appended after explicit completion.",
);

const noDecisionView = buildWorldSimulationGoalImplementationIntentionExecutionFeedbackResolverView({
  world_state: {
    motivational_goal_events: world.motivational_goal_events,
    motivational_goal_history: world.motivational_goal_history,
    goal_implementation_intention_events: world.goal_implementation_intention_events,
    goal_implementation_intention_history: world.goal_implementation_intention_history,
  },
  turn_id: "world_turn_phase69d_no_decision",
  selected_action_intents: [{ character: elias, action_id: "success_without_feedback" }],
  action_outcomes: [{ actor: elias, action_id: "success_without_feedback", result: "success" }],
});
const noDecisionBuilt = buildWorldSimulationGoalImplementationIntentionExecutionFeedback({
  world_state: {
    motivational_goal_events: world.motivational_goal_events,
    motivational_goal_history: world.motivational_goal_history,
    goal_implementation_intention_events: world.goal_implementation_intention_events,
    goal_implementation_intention_history: world.goal_implementation_intention_history,
  },
  turn_id: "world_turn_phase69d_no_decision",
  resolver_view: noDecisionView,
  feedback_decisions: [],
});
assert.equal(noDecisionBuilt.result.execution_feedback_events_created.length, 0, "Action success alone must never create a durable feedback event.");

const tamperWorld = {
  motivational_goal_events: { [proposed.goal_event_id]: proposed, [committed.goal_event_id]: committed },
  motivational_goal_history: [goalRef(proposed), goalRef(committed)],
};
const tamperPlanResolver = buildWorldSimulationGoalImplementationIntentionResolverView({ world_state: tamperWorld, turn_id: "world_turn_phase69d_tamper_plan" });
const tamperFormed = buildWorldSimulationGoalImplementationIntentionEvents({
  world_state: tamperWorld,
  turn_id: "world_turn_phase69d_tamper_plan",
  implementation_intention_decisions: [{
    character: elias,
    goal_id: goalId,
    cue_descriptor: { cue_kind: "opportunity", label: "ally_available", context: "academy_conflict" },
    response_descriptor: { response_kind: "communication", label: "request_cover", context: "planning_only" },
    resolver_view_hash: tamperPlanResolver.resolver_view_hash,
  }],
});
const tamperPlanWorld = executeBuilt(tamperWorld, "world_turn_phase69d_tamper_plan", "goal_implementation_intention", tamperFormed);
const tamperResolver = buildWorldSimulationGoalImplementationIntentionExecutionFeedbackResolverView({
  world_state: tamperPlanWorld,
  turn_id: "world_turn_phase69d_tamper_feedback",
  selected_action_intents: [{ character: elias, action_id: "tamper_action" }],
  action_outcomes: [{ actor: elias, action_id: "tamper_action", result: "success" }],
});
const tamperBuilt = buildWorldSimulationGoalImplementationIntentionExecutionFeedback({
  world_state: tamperPlanWorld,
  turn_id: "world_turn_phase69d_tamper_feedback",
  resolver_view: tamperResolver,
  feedback_decisions: [{ plan_ref: tamperResolver.plans[0].plan_ref, operation: "attempted" }],
});
const tamperedTransitions = clone(tamperBuilt.result.state_transitions);
tamperedTransitions[0].to.goal_achievement_authority = true;
const tamperedQueue = buildWorldSimulationChronologicalMutationQueue({
  turn_id: "world_turn_phase69d_tamper_feedback:goal_implementation_intention_execution_feedback",
  world_state_hash: hashAgentRunValue(tamperPlanWorld),
  state_transitions: tamperedTransitions,
  elapsed_ms: 0,
});
assert.throws(
  () => executeWorldSimulationChronologicalMutationQueue({
    world_state: tamperPlanWorld,
    preview_world_state: tamperBuilt.result.preview_world_state,
    queue: tamperedQueue,
  }),
  (error) => [
    "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_EXECUTION_FEEDBACK_EVENT_INVALID",
    "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_EXECUTION_FEEDBACK_EVENT_HASH_MISMATCH",
  ].includes(error?.code),
);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const loopSource = fs.readFileSync(path.resolve(__dirname, "../../server/src/world-simulation-loop-service.mjs"), "utf8");
assert.match(loopSource, /implementationIntentionExecutionFeedbackResolver/);
const causalIndex = loopSource.indexOf("const causalResolution = assertCausalResolution");
const feedbackIndex = loopSource.indexOf("resolveImplementationIntentionExecutionFeedbackDecisions", causalIndex);
const commitIndex = loopSource.indexOf("commitWorldSimulationTurn", feedbackIndex);
assert.ok(causalIndex >= 0 && feedbackIndex > causalIndex && commitIndex > feedbackIndex, "Phase69D feedback must consume causal evidence after adjudication and before atomic commit.");
assert.match(loopSource.slice(feedbackIndex, commitIndex), /snapshot\.state/);
assert.doesNotMatch(loopSource.slice(feedbackIndex, commitIndex), /result\s*===\s*["']success["']|includes\(["']success["']\)/i, "Loop must not infer completion from causal outcome labels.");

const replayA = projectWorldSimulationEffectiveGoalImplementationIntentionExecution({ world_state: world });
const replayB = projectWorldSimulationEffectiveGoalImplementationIntentionExecution({ world_state: clone(world) });
assert.equal(replayA.projection_hash, replayB.projection_hash);

console.log("Phase69D plan execution feedback / completion monitoring tests passed.");
