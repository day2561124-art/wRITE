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
  buildWorldSimulationGoalImplementationIntentionEvents,
  buildWorldSimulationGoalImplementationIntentionResolverView,
} from "../../server/src/world-simulation-goal-to-plan-implementation-intention-service.mjs";
import {
  buildWorldSimulationGoalImplementationIntentionRevisionContract,
  buildWorldSimulationGoalImplementationIntentionRevisionResolverView,
  buildWorldSimulationGoalImplementationIntentionRevisions,
  projectWorldSimulationEffectiveRevisedGoalImplementationIntentions,
  projectWorldSimulationRevisedGoalImplementationIntentionsForCharacter,
} from "../../server/src/world-simulation-goal-implementation-intention-revision-service.mjs";

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
      source_event_id: "self_aspect_source_69b",
      source_event_hash: "self_aspect_hash_69b",
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
function revise(world, turnId, decision) {
  const resolver = buildWorldSimulationGoalImplementationIntentionRevisionResolverView({ world_state: world, turn_id: turnId });
  const built = buildWorldSimulationGoalImplementationIntentionRevisions({
    world_state: world,
    turn_id: turnId,
    revision_decisions: [{ ...decision, resolver_view_hash: resolver.resolver_view_hash }],
  });
  return { built, world: executeBuilt(world, turnId, "goal_implementation_intention_revision", built) };
}

const elias = "伊萊亞斯・諾爾";
const rio = "里歐・瓦倫丁";
const goalId = "motivational_goal_phase69b_committed_001";
const proposed = makeGoalEvent({ character: elias, goalId, turnId: "world_turn_phase69b_goal_001", operation: "propose" });
const committed = makeGoalEvent({ character: elias, goalId, turnId: "world_turn_phase69b_goal_002", operation: "commit", previous: proposed });
let world = {
  motivational_goal_events: {
    [proposed.goal_event_id]: proposed,
    [committed.goal_event_id]: committed,
  },
  motivational_goal_history: [goalRef(proposed), goalRef(committed)],
};

const planTurn = "world_turn_phase69b_plan_001";
const planResolver = buildWorldSimulationGoalImplementationIntentionResolverView({ world_state: world, turn_id: planTurn });
const formed = buildWorldSimulationGoalImplementationIntentionEvents({
  world_state: world,
  turn_id: planTurn,
  implementation_intention_decisions: [{
    character: elias,
    goal_id: goalId,
    cue_descriptor: { cue_kind: "obstacle", label: "companion_is_threatened", context: "academy_conflict" },
    response_descriptor: { response_kind: "seek_support", label: "coordinate_with_nearby_ally", context: "without_selecting_action" },
    resolver_view_hash: planResolver.resolver_view_hash,
  }],
});
world = executeBuilt(world, planTurn, "goal_implementation_intention", formed);
const originalPlan = formed.result.implementation_intention_events_created[0];

const contract = buildWorldSimulationGoalImplementationIntentionRevisionContract();
assert.equal(contract.phase, "Phase69B");
assert.deepEqual(contract.supported_operations, ["support", "challenge", "suspend", "abandon", "revise"]);
assert.equal(contract.revise_explicitly_supersedes_target, true);
assert.equal(contract.execution_failure_monitoring_modeled, false);
assert.equal(contract.action_selection_authority_claimed, false);

let step = revise(world, "world_turn_phase69b_challenge", {
  character: elias,
  operation: "challenge",
  target_implementation_intention_id: originalPlan.implementation_intention_id,
  reason: "the current response may no longer fit the character's reconsideration",
});
world = step.world;
let projection = projectWorldSimulationEffectiveRevisedGoalImplementationIntentions({ world_state: world });
let original = projection.plans_by_character[elias][originalPlan.implementation_intention_id];
assert.equal(original.state, "challenged");
assert.equal(original.challenge_event_ids.length, 1);
assert.equal(projection.challenge_is_not_abandonment, true);

step = revise(world, "world_turn_phase69b_support", {
  character: elias,
  operation: "support",
  target_implementation_intention_id: originalPlan.implementation_intention_id,
});
world = step.world;
projection = projectWorldSimulationEffectiveRevisedGoalImplementationIntentions({ world_state: world });
original = projection.plans_by_character[elias][originalPlan.implementation_intention_id];
assert.equal(original.state, "challenged");
assert.equal(original.support_event_ids.length, 1);

const revised = revise(world, "world_turn_phase69b_revise", {
  character: elias,
  operation: "revise",
  target_implementation_intention_id: originalPlan.implementation_intention_id,
  replacement_cue_descriptor: { cue_kind: "opportunity", label: "trusted_ally_is_available", context: "academy_conflict" },
  replacement_response_descriptor: { response_kind: "communication", label: "ask_for_coordinated_cover", context: "planning_only" },
});
world = revised.world;
const reviseEvent = revised.built.result.revision_events_created[0];
assert.equal(reviseEvent.target_source_kind, "phase69a_goal_implementation_intention_event");
assert.equal(reviseEvent.target_source_event_id, originalPlan.implementation_intention_event_id);
projection = projectWorldSimulationEffectiveRevisedGoalImplementationIntentions({ world_state: world });
original = projection.plans_by_character[elias][originalPlan.implementation_intention_id];
const replacementId = reviseEvent.replacement_implementation_intention_id;
let replacement = projection.plans_by_character[elias][replacementId];
assert.equal(original.state, "superseded");
assert.equal(replacement.state, "active");
assert.equal(replacement.established_by_revision_event_id, reviseEvent.revision_event_id);

const secondRevise = revise(world, "world_turn_phase69b_revise_again", {
  character: elias,
  operation: "revise",
  target_implementation_intention_id: replacementId,
  replacement_cue_descriptor: { cue_kind: "task_juncture", label: "team_regroups", context: "academy_conflict" },
  replacement_response_descriptor: { response_kind: "cognitive_procedure", label: "reassess_support_route", context: "planning_only" },
});
world = secondRevise.world;
const secondReviseEvent = secondRevise.built.result.revision_events_created[0];
assert.equal(secondReviseEvent.target_source_kind, "phase69b_goal_implementation_intention_revision_event");
assert.equal(secondReviseEvent.target_source_event_id, reviseEvent.revision_event_id);
projection = projectWorldSimulationEffectiveRevisedGoalImplementationIntentions({ world_state: world });
replacement = projection.plans_by_character[elias][replacementId];
assert.equal(replacement.state, "superseded");
const replacement2Id = secondReviseEvent.replacement_implementation_intention_id;
assert.equal(projection.plans_by_character[elias][replacement2Id].state, "active");

step = revise(world, "world_turn_phase69b_suspend", {
  character: elias,
  operation: "suspend",
  target_implementation_intention_id: replacement2Id,
});
world = step.world;
projection = projectWorldSimulationEffectiveRevisedGoalImplementationIntentions({ world_state: world });
assert.equal(projection.plans_by_character[elias][replacement2Id].state, "suspended");

step = revise(world, "world_turn_phase69b_abandon", {
  character: elias,
  operation: "abandon",
  target_implementation_intention_id: replacement2Id,
});
world = step.world;
projection = projectWorldSimulationEffectiveRevisedGoalImplementationIntentions({ world_state: world });
assert.equal(projection.plans_by_character[elias][replacement2Id].state, "abandoned");
assert.throws(
  () => revise(world, "world_turn_phase69b_illegal_support", {
    character: elias,
    operation: "support",
    target_implementation_intention_id: replacement2Id,
  }),
  (error) => error?.code === "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_REVISION_STATE_TRANSITION_INVALID",
);

assert.throws(
  () => revise(world, "world_turn_phase69b_cross_character", {
    character: rio,
    operation: "challenge",
    target_implementation_intention_id: originalPlan.implementation_intention_id,
  }),
  (error) => error?.code === "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_REVISION_TARGET_INVALID",
);

assert.throws(
  () => revise(world, "world_turn_phase69b_new_active", {
    character: elias,
    operation: "revise",
    target_implementation_intention_id: replacement2Id,
    replacement_cue_descriptor: { cue_kind: "internal_state", label: "regained_focus" },
    replacement_response_descriptor: { response_kind: "cognitive_procedure", label: "review_next_step" },
  }),
  (error) => error?.code === "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_REVISION_STATE_TRANSITION_INVALID",
);

const projectionForCharacter = projectWorldSimulationRevisedGoalImplementationIntentionsForCharacter({
  world_state: world,
  character: elias,
  current_turn_id: "world_turn_phase69b_future",
});
assert.equal(projectionForCharacter.audit.plan_ids_exposed, false);
assert.equal(projectionForCharacter.audit.action_selection_authority_exposed, false);
assert.equal(projectionForCharacter.audit.execution_failure_or_feasibility_authority_exposed, false);

const badWorld = clone(world);
const latestRevisionRef = badWorld.goal_implementation_intention_revision_history.at(-1);
const latestRevision = badWorld.goal_implementation_intention_revision_events[latestRevisionRef.revision_event_id];
latestRevision.target_source_event_hash = "tampered_source_hash";
const body = clone(latestRevision);
delete body.revision_event_hash;
latestRevision.revision_event_hash = hashAgentRunValue(body);
latestRevisionRef.revision_event_hash = latestRevision.revision_event_hash;
assert.throws(
  () => projectWorldSimulationEffectiveRevisedGoalImplementationIntentions({ world_state: badWorld }),
  (error) => error?.code === "WORLD_SIMULATION_GOAL_IMPLEMENTATION_INTENTION_REVISION_TARGET_SOURCE_INVALID",
);

const queueContract = buildWorldSimulationChronologicalMutationQueueContract();
assert.equal(queueContract.execution.phase69b_goal_implementation_intention_revision_event_write_once_enforced, true);
assert.equal(queueContract.execution.phase69b_target_plan_canonical_provenance_enforced, true);
assert.equal(queueContract.execution.phase69b_executable_action_authority_rejected, true);
assert.equal(queueContract.execution.phase69b_execution_failure_feasibility_oracle_rejected, true);

const replayA = projectWorldSimulationEffectiveRevisedGoalImplementationIntentions({ world_state: world });
const replayB = projectWorldSimulationEffectiveRevisedGoalImplementationIntentions({ world_state: clone(world) });
assert.equal(replayA.projection_hash, replayB.projection_hash);
assert.equal(Object.hasOwn(world, "selected_action"), false);
assert.equal(Object.hasOwn(world, "execution_monitor"), false);

console.log("Phase69B implementation-intention revision tests passed.");
