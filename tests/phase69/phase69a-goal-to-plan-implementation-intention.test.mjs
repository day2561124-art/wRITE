import assert from "node:assert/strict";

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
  buildWorldSimulationGoalImplementationIntentionContract,
  buildWorldSimulationGoalImplementationIntentionEvents,
  buildWorldSimulationGoalImplementationIntentionResolverView,
  projectWorldSimulationEffectiveGoalImplementationIntentions,
  projectWorldSimulationGoalImplementationIntentionsForCharacter,
} from "../../server/src/world-simulation-goal-to-plan-implementation-intention-service.mjs";

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
  const base = {
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
      source_event_id: "self_aspect_source_001",
      source_event_hash: "self_aspect_hash_001",
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
  base.goal_event_hash = goalHash(base);
  return base;
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

const elias = "伊萊亞斯・諾爾";
const goalId = "motivational_goal_phase69a_committed_001";
const proposed = makeGoalEvent({ character: elias, goalId, turnId: "world_turn_phase69a_goal_001", operation: "propose" });
const committed = makeGoalEvent({ character: elias, goalId, turnId: "world_turn_phase69a_goal_002", operation: "commit", previous: proposed });
let world = {
  motivational_goal_events: {
    [proposed.goal_event_id]: proposed,
    [committed.goal_event_id]: committed,
  },
  motivational_goal_history: [goalRef(proposed), goalRef(committed)],
};

const contract = buildWorldSimulationGoalImplementationIntentionContract();
assert.equal(contract.phase, "Phase69A");
assert.deepEqual(contract.supported_operations, ["form"]);
assert.equal(contract.committed_goal_required, true);
assert.equal(contract.selected_action_authority_claimed, false);
assert.equal(contract.executable_action_ids_modeled, false);

const turn1 = "world_turn_phase69a_001";
const resolver = buildWorldSimulationGoalImplementationIntentionResolverView({ world_state: world, turn_id: turn1 });
assert.equal(resolver.committed_goal_sources.length, 1);
assert.equal(resolver.committed_goal_sources[0].goal_id, goalId);
assert.equal(resolver.raw_world_state_exposed, false);
assert.equal(resolver.executable_action_ids_exposed, false);

const built = buildWorldSimulationGoalImplementationIntentionEvents({
  world_state: world,
  turn_id: turn1,
  implementation_intention_decisions: [{
    character: elias,
    operation: "form",
    goal_id: goalId,
    cue_descriptor: { cue_kind: "obstacle", label: "companion_is_threatened", context: "academy_conflict" },
    response_descriptor: { response_kind: "seek_support", label: "coordinate_with_nearby_ally", context: "without_selecting_action" },
    resolver_view_hash: resolver.resolver_view_hash,
  }],
});
const planEvent = built.result.implementation_intention_events_created[0];
assert.equal(planEvent.subjective_prospective_plan, true);
assert.equal(planEvent.selected_action_authority, false);
assert.equal(planEvent.executable_action_id, null);
assert.equal(planEvent.utility_score, null);
world = executeBuilt(world, turn1, "goal_implementation_intention", built);

let projection = projectWorldSimulationEffectiveGoalImplementationIntentions({ world_state: world });
let plan = projection.plans_by_character[elias][planEvent.implementation_intention_id];
assert.equal(plan.state, "active");
assert.equal(projection.multiple_plans_per_goal_allowed, true);
assert.equal(projection.action_selection_authority_claimed, false);

assert.throws(
  () => projectWorldSimulationGoalImplementationIntentionsForCharacter({
    world_state: world,
    character: elias,
    current_turn_id: turn1,
  }),
  (error) => error?.code === "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_SAME_TURN_CONTAMINATION",
);
const characterProjection = projectWorldSimulationGoalImplementationIntentionsForCharacter({
  world_state: world,
  character: elias,
  current_turn_id: "world_turn_phase69a_002",
});
assert.equal(characterProjection.character_view.implementation_intentions.length, 1);
assert.equal(characterProjection.audit.implementation_intention_ids_exposed, false);
assert.equal(characterProjection.audit.executable_action_ids_exposed, false);
assert.equal(characterProjection.audit.selected_action_authority_exposed, false);

assert.throws(
  () => buildWorldSimulationGoalImplementationIntentionEvents({
    world_state: world,
    turn_id: "world_turn_phase69a_bad_action",
    implementation_intention_decisions: [{
      character: elias,
      goal_id: goalId,
      cue_descriptor: { cue_kind: "situation", label: "door_opens" },
      response_descriptor: { response_kind: "initiate_behavior", label: "move", action_id: "action_forbidden" },
    }],
  }),
  (error) => error?.code === "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_EXECUTION_AUTHORITY_FORBIDDEN",
);

const suspended = makeGoalEvent({ character: elias, goalId, turnId: "world_turn_phase69a_goal_003", operation: "suspend", previous: committed });
world = clone(world);
world.motivational_goal_events[suspended.goal_event_id] = suspended;
world.motivational_goal_history.push(goalRef(suspended));
projection = projectWorldSimulationEffectiveGoalImplementationIntentions({ world_state: world });
plan = projection.plans_by_character[elias][planEvent.implementation_intention_id];
assert.equal(plan.state, "inactive_source_goal_not_committed");
assert.equal(world.goal_implementation_intention_events[planEvent.implementation_intention_event_id].implementation_intention_event_hash,
  planEvent.implementation_intention_event_hash);

assert.throws(
  () => buildWorldSimulationGoalImplementationIntentionEvents({
    world_state: world,
    turn_id: "world_turn_phase69a_suspended_source",
    implementation_intention_decisions: [{
      character: elias,
      goal_id: goalId,
      cue_descriptor: { cue_kind: "opportunity", label: "safe_opening" },
      response_descriptor: { response_kind: "communication", label: "signal_ally" },
    }],
  }),
  (error) => error?.code === "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_SOURCE_GOAL_NOT_COMMITTED",
);

const badGoal = makeGoalEvent({
  character: elias,
  goalId: "motivational_goal_phase68d_guard_regression",
  turnId: "world_turn_phase69a_phase68d_guard",
  operation: "propose",
  previous: suspended,
});
badGoal.action_plan_generated = true;
badGoal.goal_event_hash = goalHash(badGoal);
const badGoalPreview = clone(world);
badGoalPreview.motivational_goal_events[badGoal.goal_event_id] = badGoal;
const badGoalQueue = buildWorldSimulationChronologicalMutationQueue({
  turn_id: `${badGoal.source_turn_id}:motivation_goal_integration`,
  world_state_hash: hashAgentRunValue(world),
  state_transitions: [{
    entity: "world",
    field: `motivational_goal_events.${badGoal.goal_event_id}`,
    from: null,
    to: badGoal,
    cause: "phase68d validator invocation regression",
    source_layer: "motivation_goal_integration",
  }],
  elapsed_ms: 0,
});
assert.throws(
  () => executeWorldSimulationChronologicalMutationQueue({
    world_state: world,
    preview_world_state: badGoalPreview,
    queue: badGoalQueue,
  }),
  (error) => error?.code === "WORLD_SIMULATION_MOTIVATIONAL_GOAL_EVENT_INVALID",
);

const queueContract = buildWorldSimulationChronologicalMutationQueueContract();
assert.equal(queueContract.execution.phase68d_authoritative_queue_validator_invoked, true);
assert.equal(queueContract.execution.phase69a_goal_implementation_intention_event_write_once_enforced, true);
assert.equal(queueContract.execution.phase69a_committed_source_goal_hash_pinning_enforced, true);
assert.equal(queueContract.execution.phase69a_executable_action_authority_rejected, true);

const replayA = projectWorldSimulationEffectiveGoalImplementationIntentions({ world_state: world });
const replayB = projectWorldSimulationEffectiveGoalImplementationIntentions({ world_state: clone(world) });
assert.equal(replayA.projection_hash, replayB.projection_hash);
assert.equal(Object.hasOwn(world, "selected_action"), false);
assert.equal(Object.hasOwn(world, "plan_tree"), false);

console.log("Phase69A goal-to-plan implementation-intention tests passed.");
