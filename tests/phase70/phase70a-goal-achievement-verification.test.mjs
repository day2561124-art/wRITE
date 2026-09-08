import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import {
  buildWorldSimulationChronologicalMutationQueue,
  buildWorldSimulationChronologicalMutationQueueContract,
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
  projectWorldSimulationEffectiveGoalImplementationIntentions,
} from "../../server/src/world-simulation-goal-to-plan-implementation-intention-service.mjs";
import {
  buildWorldSimulationGoalAchievementEvents,
  buildWorldSimulationGoalAchievementResolverView,
  buildWorldSimulationGoalAchievementVerificationContract,
  projectWorldSimulationEffectiveMotivationalGoalLifecycle,
  projectWorldSimulationMotivationalGoalLifecycleForCharacter,
  worldSimulationGoalAchievementVerificationVersion,
} from "../../server/src/world-simulation-goal-achievement-verification-service.mjs";

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
function makeGoalEvent({ character, goalId, turnId, operation, goalKind = "achieve_state", previous = null }) {
  const event = {
    schema_version: motivationalGoalEventSchemaVersion,
    version: worldSimulationMotivationGoalIntegrationVersion,
    immutable: true,
    character,
    source_turn_id: turnId,
    operation,
    goal_id: goalId,
    goal_kind: goalKind,
    domain: "academy_task",
    target_descriptor: { label: "reach_safe_room", context: "phase70_acceptance" },
    motivation_basis_refs: [{
      source_kind: "phase68b_structured_self_model_aspect_event",
      source_event_id: "phase70_source_aspect",
      source_event_hash: "phase70_source_hash",
    }],
    motivation_relations: ["self_concordant_with"],
    resolver_view_hash: `phase70_goal_resolver_${turnId}`,
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
function committedGoalWorld({ character = "伊萊亞斯・諾爾", goalId = "phase70_goal_001", goalKind = "achieve_state" } = {}) {
  const proposed = makeGoalEvent({ character, goalId, turnId: `${goalId}_propose`, operation: "propose", goalKind });
  const committed = makeGoalEvent({ character, goalId, turnId: `${goalId}_commit`, operation: "commit", goalKind, previous: proposed });
  return {
    character,
    goalId,
    proposed,
    committed,
    world: {
      motivational_goal_events: {
        [proposed.goal_event_id]: proposed,
        [committed.goal_event_id]: committed,
      },
      motivational_goal_history: [goalRef(proposed), goalRef(committed)],
    },
  };
}
function executeBuilt(world, turnId, layer, built) {
  const queueInput = {
    turn_id: `${turnId}:${layer}`,
    world_state_hash: hashAgentRunValue(world),
    state_transitions: built.result.state_transitions,
    elapsed_ms: 0,
  };
  if (built.result.authoritative_validation_context) {
    queueInput.validation_context = {
      goal_achievement_verification: built.result.authoritative_validation_context,
    };
  }
  const queue = buildWorldSimulationChronologicalMutationQueue(queueInput);
  return executeWorldSimulationChronologicalMutationQueue({
    world_state: world,
    preview_world_state: built.result.preview_world_state,
    queue,
  }).next_world_state;
}
function achievementResolver(world, turnId, evidence = {}) {
  return buildWorldSimulationGoalAchievementResolverView({
    world_state: world,
    turn_id: turnId,
    state_transitions: evidence.state_transitions ?? [{ entity: "character", field: "location", from: "hall", to: "safe_room" }],
    action_outcomes: evidence.action_outcomes ?? [{ actor: "伊萊亞斯・諾爾", action_id: "move_001", result: "success" }],
    knowledge_transitions: evidence.knowledge_transitions ?? [],
  });
}

const contract = buildWorldSimulationGoalAchievementVerificationContract();
assert.equal(contract.phase, "Phase70A");
assert.deepEqual(contract.supported_operations, ["achieve"]);
assert.deepEqual(contract.eligible_goal_kinds, ["achieve_state", "restore_state"]);
assert.deepEqual(contract.eligible_goal_states, ["committed", "suspended"]);
assert.equal(contract.action_success_implies_goal_achievement, false);
assert.equal(contract.plan_fulfillment_implies_goal_achievement, false);
assert.equal(contract.plan_completion_implies_goal_achievement, false);
assert.equal(contract.failure_or_unattainability_modeled, false);
assert.equal(contract.authoritative_mutation_owner, "phase62k-authoritative-mutation-executor-v1");

const queueContract = buildWorldSimulationChronologicalMutationQueueContract();
assert.equal(queueContract.execution.phase70a_goal_achievement_event_write_once_enforced, true);
assert.equal(queueContract.execution.phase70a_authoritative_queue_validator_invoked, true);
assert.equal(queueContract.execution.phase70a_achieved_goal_is_terminal_for_phase68d_transitions, true);
assert.equal(queueContract.execution.phase70a_achieved_goal_rejected_as_phase69a_plan_source, true);

const base = committedGoalWorld();
let world = base.world;
const planTurn = "phase70_plan_turn";
const planResolver = buildWorldSimulationGoalImplementationIntentionResolverView({ world_state: world, turn_id: planTurn });
assert.equal(planResolver.committed_goal_sources.length, 1);
const formed = buildWorldSimulationGoalImplementationIntentionEvents({
  world_state: world,
  turn_id: planTurn,
  implementation_intention_decisions: [{
    character: base.character,
    goal_id: base.goalId,
    cue_descriptor: { cue_kind: "opportunity", label: "safe_route_opens", context: "phase70_acceptance" },
    response_descriptor: { response_kind: "initiate_behavior", label: "move_to_safe_room", context: "planning_only" },
    resolver_view_hash: planResolver.resolver_view_hash,
  }],
});
world = executeBuilt(world, planTurn, "goal_implementation_intention", formed);
const formedPlan = formed.result.implementation_intention_events_created[0];
assert.ok(formedPlan);

// Successful causal evidence alone must never auto-promote the goal.
const noDecisionTurn = "phase70_no_decision";
const noDecisionView = achievementResolver(world, noDecisionTurn, {
  action_outcomes: [{ actor: base.character, action_id: "move_success", result: "success" }],
  state_transitions: [],
});
const noDecisionBuilt = buildWorldSimulationGoalAchievementEvents({
  world_state: world,
  turn_id: noDecisionTurn,
  resolver_view: noDecisionView,
  achievement_decisions: [],
});
assert.equal(noDecisionBuilt.result.achievement_events_created.length, 0);
assert.equal(noDecisionBuilt.result.effective_goal_lifecycle_projection.goals_by_character[base.character][base.goalId].achieved, false);

// A Phase69D-style completion record is not achievement evidence by itself.
const completedOnly = clone(world);
completedOnly.goal_implementation_intention_execution_feedback_events = {
  fake_completed: {
    operation: "completed",
    goal_id: base.goalId,
    implementation_intention_id: formedPlan.implementation_intention_id,
  },
};
const completedOnlyView = achievementResolver(completedOnly, "phase70_completed_only", {
  action_outcomes: [], state_transitions: [], knowledge_transitions: [],
});
const completedOnlyBuilt = buildWorldSimulationGoalAchievementEvents({
  world_state: completedOnly,
  turn_id: "phase70_completed_only",
  resolver_view: completedOnlyView,
  achievement_decisions: [],
});
assert.equal(completedOnlyBuilt.result.achievement_events_created.length, 0, "Plan completion must not auto-achieve a goal.");

const achieveTurn = "phase70_explicit_achievement";
const resolverView = achievementResolver(world, achieveTurn, {
  state_transitions: [{ entity: "character", field: "location", from: "hall", to: "safe_room", cause: "authoritative movement resolution" }],
  action_outcomes: [{ actor: base.character, action_id: "move_002", result: "arrived_safe_room" }],
});
assert.equal(resolverView.version, worldSimulationGoalAchievementVerificationVersion);
assert.equal(resolverView.eligible_goals.length, 1);
assert.ok(resolverView.authoritative_evidence.length >= 2);

// Resolver evidence order is canonicalized, so equivalent decisions replay identically.
const reversedEvidenceRefs = resolverView.authoritative_evidence.map((entry) => entry.evidence_ref).reverse();
const decision = {
  goal_ref: resolverView.eligible_goals[0].goal_ref,
  operation: "achieve",
  evidence_refs: reversedEvidenceRefs,
};
const builtA = buildWorldSimulationGoalAchievementEvents({
  world_state: world,
  turn_id: achieveTurn,
  resolver_view: resolverView,
  achievement_decisions: [decision],
});
const builtB = buildWorldSimulationGoalAchievementEvents({
  world_state: clone(world),
  turn_id: achieveTurn,
  resolver_view: clone(resolverView),
  achievement_decisions: [{ ...decision, evidence_refs: [...reversedEvidenceRefs].reverse() }],
});
assert.equal(
  builtA.result.achievement_events_created[0].goal_achievement_event_hash,
  builtB.result.achievement_events_created[0].goal_achievement_event_hash,
  "Equivalent evidence sets must produce deterministic achievement identity regardless of resolver ordering.",
);
world = executeBuilt(world, achieveTurn, "goal_achievement_verification", builtA);

const lifecycle = projectWorldSimulationEffectiveMotivationalGoalLifecycle({ world_state: world });
assert.equal(lifecycle.goals_by_character[base.character][base.goalId].achieved, true);
assert.equal(world.motivational_goal_events[base.committed.goal_event_id].operation, "commit", "Achievement must not rewrite Phase68D history.");
assert.equal(world.motivational_goal_history.length, 2);
assert.ok(world.goal_implementation_intention_events[formedPlan.implementation_intention_event_id], "Historical plan must be preserved.");

const afterAchievementPlans = projectWorldSimulationEffectiveGoalImplementationIntentions({ world_state: world });
assert.equal(
  afterAchievementPlans.plans_by_character[base.character][formedPlan.implementation_intention_id].state,
  "inactive_source_goal_not_committed",
  "Existing plans must become inactive after source goal achievement.",
);
const afterAchievementResolver = buildWorldSimulationGoalImplementationIntentionResolverView({
  world_state: world,
  turn_id: "phase70_future_plan",
});
assert.equal(afterAchievementResolver.committed_goal_sources.length, 0, "Achieved goals cannot source new Phase69A plans.");

const characterProjection = projectWorldSimulationMotivationalGoalLifecycleForCharacter({
  world_state: world,
  character: base.character,
  current_turn_id: "phase70_later_turn",
});
assert.equal(characterProjection.character_view.goals.length, 0, "Achieved goals must be hidden from current-goal character projection.");
assert.equal(characterProjection.character_view.achieved_goals_hidden, true);
assert.throws(
  () => projectWorldSimulationMotivationalGoalLifecycleForCharacter({
    world_state: world,
    character: base.character,
    current_turn_id: achieveTurn,
  }),
  (error) => error?.code === "WORLD_SIMULATION_GOAL_ACHIEVEMENT_SAME_TURN_CONTAMINATION",
);

// Duplicate achievement is terminally forbidden.
assert.throws(
  () => buildWorldSimulationGoalAchievementEvents({
    world_state: world,
    turn_id: "phase70_duplicate",
    resolver_view: buildWorldSimulationGoalAchievementResolverView({
      world_state: world,
      turn_id: "phase70_duplicate",
      state_transitions: [{ entity: "character", field: "location", from: "safe_room", to: "safe_room" }],
    }),
    achievement_decisions: [{ goal_ref: resolverView.eligible_goals[0].goal_ref, evidence_refs: [resolverView.authoritative_evidence[0].evidence_ref] }],
  }),
  (error) => ["WORLD_SIMULATION_GOAL_ACHIEVEMENT_TARGET_INVALID", "WORLD_SIMULATION_GOAL_ACHIEVEMENT_DUPLICATE_FORBIDDEN"].includes(error?.code),
);

// maintain_state is horizon-sensitive and cannot be terminally achieved in Phase70A v1.
const maintain = committedGoalWorld({ goalId: "phase70_maintain_goal", goalKind: "maintain_state" });
const maintainView = achievementResolver(maintain.world, "phase70_maintain_turn");
assert.equal(maintainView.eligible_goals.length, 0);

// Phase62K rejects forged achievement payloads even when they arrive through a chronological queue.
const tamperBase = committedGoalWorld({ goalId: "phase70_tamper_goal" });
const tamperView = achievementResolver(tamperBase.world, "phase70_tamper_turn");
const tamperBuilt = buildWorldSimulationGoalAchievementEvents({
  world_state: tamperBase.world,
  turn_id: "phase70_tamper_turn",
  resolver_view: tamperView,
  achievement_decisions: [{
    goal_ref: tamperView.eligible_goals[0].goal_ref,
    evidence_refs: [tamperView.authoritative_evidence[0].evidence_ref],
  }],
});
const missingContextQueue = buildWorldSimulationChronologicalMutationQueue({
  turn_id: "phase70_tamper_turn:goal_achievement_verification",
  world_state_hash: hashAgentRunValue(tamperBase.world),
  state_transitions: tamperBuilt.result.state_transitions,
  elapsed_ms: 0,
});
assert.throws(
  () => executeWorldSimulationChronologicalMutationQueue({
    world_state: tamperBase.world,
    preview_world_state: tamperBuilt.result.preview_world_state,
    queue: missingContextQueue,
  }),
  (error) => error?.code === "WORLD_SIMULATION_GOAL_ACHIEVEMENT_VALIDATION_CONTEXT_REQUIRED",
  "Phase70A durable achievement writes must be rejected without bounded current-turn authoritative validation context.",
);

const tamperedTransitions = clone(tamperBuilt.result.state_transitions);
tamperedTransitions[0].to.numeric_scoring_modeled = true;
const tamperedQueue = buildWorldSimulationChronologicalMutationQueue({
  turn_id: "phase70_tamper_turn:goal_achievement_verification",
  world_state_hash: hashAgentRunValue(tamperBase.world),
  state_transitions: tamperedTransitions,
  validation_context: {
    goal_achievement_verification: tamperBuilt.result.authoritative_validation_context,
  },
  elapsed_ms: 0,
});
assert.throws(
  () => executeWorldSimulationChronologicalMutationQueue({
    world_state: tamperBase.world,
    preview_world_state: tamperBuilt.result.preview_world_state,
    queue: tamperedQueue,
  }),
  (error) => ["WORLD_SIMULATION_GOAL_ACHIEVEMENT_EVENT_INVALID", "WORLD_SIMULATION_GOAL_ACHIEVEMENT_EVENT_HASH_MISMATCH"].includes(error?.code),
);

const tamperedContext = clone(tamperBuilt.result.authoritative_validation_context);
tamperedContext.authoritative_evidence[0].evidence = { forged: true };
const tamperedContextQueue = buildWorldSimulationChronologicalMutationQueue({
  turn_id: "phase70_tamper_turn:goal_achievement_verification",
  world_state_hash: hashAgentRunValue(tamperBase.world),
  state_transitions: tamperBuilt.result.state_transitions,
  validation_context: { goal_achievement_verification: tamperedContext },
  elapsed_ms: 0,
});
assert.throws(
  () => executeWorldSimulationChronologicalMutationQueue({
    world_state: tamperBase.world,
    preview_world_state: tamperBuilt.result.preview_world_state,
    queue: tamperedContextQueue,
  }),
  (error) => error?.code === "WORLD_SIMULATION_GOAL_ACHIEVEMENT_VALIDATION_CONTEXT_INVALID",
  "Phase62K must independently verify the bounded authoritative evidence catalog.",
);

// An already-achieved Phase68D goal cannot be mutated later by the older lifecycle layer.
const abandonAfterAchievement = makeGoalEvent({
  character: base.character,
  goalId: base.goalId,
  turnId: "phase70_illegal_abandon",
  operation: "abandon",
  previous: base.committed,
});
const illegalTransition = {
  entity: "world",
  field: `motivational_goal_events.${abandonAfterAchievement.goal_event_id}`,
  from: null,
  to: abandonAfterAchievement,
  cause: "illegal post-achievement abandon",
  source_layer: "motivation_goal_integration",
};
const illegalQueue = buildWorldSimulationChronologicalMutationQueue({
  turn_id: "phase70_illegal_abandon:motivation_goal_integration",
  world_state_hash: hashAgentRunValue(world),
  state_transitions: [illegalTransition],
  elapsed_ms: 0,
});
assert.throws(
  () => executeWorldSimulationChronologicalMutationQueue({
    world_state: world,
    preview_world_state: { ...clone(world), motivational_goal_events: { ...clone(world.motivational_goal_events), [abandonAfterAchievement.goal_event_id]: abandonAfterAchievement } },
    queue: illegalQueue,
  }),
  (error) => error?.code === "WORLD_SIMULATION_MOTIVATIONAL_GOAL_ACHIEVED_TERMINAL",
);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const loopSource = fs.readFileSync(path.resolve(__dirname, "../../server/src/world-simulation-loop-service.mjs"), "utf8");
const causalIndex = loopSource.indexOf("const causalResolution = assertCausalResolution");
const feedbackIndex = loopSource.indexOf("resolveImplementationIntentionExecutionFeedbackDecisions", causalIndex);
const achievementIndex = loopSource.indexOf("resolveGoalAchievementDecisions", feedbackIndex);
const viabilityIndex = loopSource.indexOf("resolveGoalViabilityDecisions", achievementIndex);
const commitIndex = loopSource.indexOf("commitWorldSimulationTurn", viabilityIndex);
const postCommitIndex = loopSource.indexOf("let committedCurrentMindDelivery", commitIndex);
assert.ok(
  causalIndex >= 0
    && feedbackIndex > causalIndex
    && achievementIndex > feedbackIndex
    && viabilityIndex > achievementIndex
    && commitIndex > viabilityIndex
    && postCommitIndex > commitIndex,
  "Phase70A must run after causal adjudication and Phase69D feedback, before Phase70B and atomic commit.",
);
assert.match(loopSource.slice(achievementIndex, viabilityIndex), /snapshot\.state/);
assert.match(loopSource.slice(commitIndex, postCommitIndex), /visibleConstraintObservationMutationExecution\.next_world_state/);
assert.doesNotMatch(loopSource.slice(achievementIndex, commitIndex), /result\s*===\s*["']success["']|includes\(["']success["']\)/i,
  "Loop must not infer achievement from success labels.");

const replayA = projectWorldSimulationEffectiveMotivationalGoalLifecycle({ world_state: world });
const replayB = projectWorldSimulationEffectiveMotivationalGoalLifecycle({ world_state: clone(world) });
assert.equal(replayA.projection_hash, replayB.projection_hash);

console.log("Phase70A explicit goal achievement verification tests passed.");
