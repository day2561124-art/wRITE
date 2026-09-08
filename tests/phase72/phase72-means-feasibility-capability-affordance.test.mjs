import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import {
  buildWorldSimulationChronologicalMutationQueue,
  buildWorldSimulationChronologicalMutationQueueContract,
  executeWorldSimulationChronologicalMutationQueue,
  projectWorldSimulationChronologicalMutationQueue,
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
  projectWorldSimulationEffectiveGoalImplementationIntentionExecution,
} from "../../server/src/world-simulation-goal-implementation-intention-execution-feedback-service.mjs";
import {
  buildWorldSimulationMeansFeasibilityContract,
  buildWorldSimulationMeansFeasibilityEvents,
  buildWorldSimulationMeansFeasibilityResolverView,
  projectWorldSimulationEffectiveMeansFeasibility,
  worldSimulationMeansFeasibilityVersion,
} from "../../server/src/world-simulation-means-feasibility-service.mjs";

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function goalHash(event) {
  const body = clone(event);
  delete body.goal_event_hash;
  return hashAgentRunValue(body);
}
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
function makeGoalEvent({ operation, turnId, previous = null }) {
  const event = {
    schema_version: motivationalGoalEventSchemaVersion,
    version: worldSimulationMotivationGoalIntegrationVersion,
    immutable: true,
    character: CHARACTER,
    source_turn_id: turnId,
    operation,
    goal_id: GOAL_ID,
    goal_kind: "achieve_state",
    domain: "academy_task",
    target_descriptor: {
      label: "enter_research_room",
      context: "phase72_acceptance",
    },
    motivation_basis_refs: [{
      source_kind: "phase68b_structured_self_model_aspect_event",
      source_event_id: "phase72_source_aspect",
      source_event_hash: "phase72_source_aspect_hash",
    }],
    motivation_relations: ["self_concordant_with"],
    resolver_view_hash: `phase72_goal_resolver_${turnId}`,
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
function executeBuilt(world, turnId, layer, built, validationContext = null) {
  const queueInput = {
    turn_id: `${turnId}:${layer}`,
    world_state_hash: hashAgentRunValue(world),
    state_transitions: built.result.state_transitions,
    elapsed_ms: 0,
  };
  if (validationContext) queueInput.validation_context = validationContext;
  const queue = buildWorldSimulationChronologicalMutationQueue(queueInput);
  return executeWorldSimulationChronologicalMutationQueue({
    world_state: world,
    preview_world_state: built.result.preview_world_state,
    queue,
  });
}
function makeResolverView(world, turnId, {
  actor = CHARACTER,
  result = "blocked",
  blocker = result === "blocked" ? "exterior_surface_not_climbable" : null,
} = {}) {
  return buildWorldSimulationMeansFeasibilityResolverView({
    world_state: world,
    turn_id: turnId,
    selected_action_intents: [{
      character: actor,
      action_id: `action_${turnId}`,
      intent: "use_window_route",
    }],
    action_outcomes: [{
      actor,
      action_id: `action_${turnId}`,
      result,
      blocker,
    }],
    state_transitions: [{
      entity: "world",
      field: "research_room_window_access",
      from: "unchecked",
      to: result === "blocked" ? "blocked" : "available",
      cause: `phase72_${result}`,
    }],
  });
}
function buildFeasibility(world, turnId, resolverView, decision) {
  return buildWorldSimulationMeansFeasibilityEvents({
    world_state: world,
    turn_id: turnId,
    resolver_view: resolverView,
    feasibility_decisions: [decision],
  });
}
function buildPhase72Queue(world, turnId, built, validationContext = built.result.authoritative_validation_context) {
  const input = {
    turn_id: `${turnId}:means_feasibility_capability_affordance`,
    world_state_hash: hashAgentRunValue(world),
    state_transitions: built.result.state_transitions,
    elapsed_ms: 0,
  };
  if (validationContext) {
    input.validation_context = {
      means_feasibility_capability_affordance: validationContext,
    };
  }
  return buildWorldSimulationChronologicalMutationQueue(input);
}

const CHARACTER = "伊萊亞斯・諾爾";
const OTHER_CHARACTER = "莉亞・艾爾文";
const GOAL_ID = "phase72_goal_enter_room";
const PLAN_TURN = "phase72_plan_formation";

const proposed = makeGoalEvent({ operation: "propose", turnId: "phase72_goal_propose" });
const committed = makeGoalEvent({ operation: "commit", turnId: "phase72_goal_commit", previous: proposed });
let world = {
  motivational_goal_events: {
    [proposed.goal_event_id]: proposed,
    [committed.goal_event_id]: committed,
  },
  motivational_goal_history: [goalRef(proposed), goalRef(committed)],
};

const planResolver = buildWorldSimulationGoalImplementationIntentionResolverView({
  world_state: world,
  turn_id: PLAN_TURN,
});
const planBuilt = buildWorldSimulationGoalImplementationIntentionEvents({
  world_state: world,
  turn_id: PLAN_TURN,
  implementation_intention_decisions: [{
    character: CHARACTER,
    goal_id: GOAL_ID,
    cue_descriptor: {
      cue_kind: "obstacle",
      label: "door_route_unavailable",
      context: "consider_known_window_route",
    },
    response_descriptor: {
      response_kind: "initiate_behavior",
      label: "use_window_route",
      context: "represented_means_only",
    },
    resolver_view_hash: planResolver.resolver_view_hash,
  }],
});
world = executeBuilt(world, PLAN_TURN, "goal_implementation_intention", planBuilt).next_world_state;
const plan = planBuilt.result.implementation_intention_events_created[0];

const contract = buildWorldSimulationMeansFeasibilityContract();
assert.equal(contract.phase, "Phase72");
assert.equal(contract.version, worldSimulationMeansFeasibilityVersion);
assert.deepEqual(contract.supported_constraint_kinds, ["capability", "resource", "environment", "permission"]);
assert.equal(contract.complete_coverage_required_to_claim_feasible, true);
assert.equal(contract.physical_executability_required_to_claim_feasible, true);
assert.equal(contract.physical_executability_separate_from_authorization, true);
assert.equal(contract.indeterminate_is_not_blocked, true);
assert.equal(contract.means_blocked_implies_goal_unattainable, false);
assert.equal(contract.means_blocked_implies_plan_abandonment, false);
assert.equal(contract.alternative_means_generation_modeled, false);
assert.equal(contract.automatic_same_turn_replanning_modeled, false);
assert.equal(contract.engine_world_truth_auto_updates_character_knowledge, false);
assert.equal(contract.numeric_utility_probability_feasibility_score_modeled, false);

const queueContract = buildWorldSimulationChronologicalMutationQueueContract();
assert.equal(queueContract.execution.phase72_means_feasibility_event_write_once_enforced, true);
assert.equal(queueContract.execution.phase72_current_turn_engine_evidence_catalog_hash_verified, true);
assert.equal(queueContract.execution.phase72_cross_character_evidence_rejected, true);
assert.equal(queueContract.execution.phase72_complete_coverage_required_to_claim_feasible, true);
assert.equal(queueContract.execution.phase72_physical_executability_required_to_claim_feasible, true);
assert.equal(queueContract.execution.phase72_derived_means_physical_authorization_status_recomputed, true);
assert.equal(queueContract.execution.phase72_world_truth_does_not_auto_update_character_knowledge, true);
assert.equal(queueContract.execution.phase72_authoritative_queue_validator_invoked, true);

const BLOCKED_TURN = "phase72_blocked_turn";
const blockedView = makeResolverView(world, BLOCKED_TURN);
assert.equal(blockedView.source_plans.length, 1);
const sourcePlan = blockedView.source_plans[0];
assert.equal(sourcePlan.character, CHARACTER);
assert.equal(sourcePlan.goal_id, GOAL_ID);
assert.equal(sourcePlan.implementation_intention_id, plan.implementation_intention_id);
assert.equal(blockedView.raw_world_state_exposed, false);
assert.equal(blockedView.raw_memory_store_exposed, false);
assert.equal(blockedView.hidden_retrieval_graph_exposed, false);
assert.equal(blockedView.physical_executability_required_to_claim_feasible, true);
assert.equal(blockedView.numeric_scoring_requested, false);
const blockedOutcome = blockedView.authoritative_evidence.find((entry) => entry.evidence_kind === "action_outcome");
assert.ok(blockedOutcome);
assert.equal(blockedOutcome.evidence_character, CHARACTER);

const blockedBuilt = buildFeasibility(world, BLOCKED_TURN, blockedView, {
  source_plan_ref: sourcePlan.source_plan_ref,
  coverage_complete: true,
  constraint_checks: [{
    constraint_kind: "environment",
    constraint_code: "exterior_surface_not_climbable",
    constraint_status: "unsatisfied",
    evidence_refs: [blockedOutcome.evidence_ref],
  }],
  character_visible_evidence_refs: [],
});
const blockedEvent = blockedBuilt.result.means_feasibility_events_created[0];
assert.equal(blockedEvent.means_status, "blocked");
assert.equal(blockedEvent.physical_executability, "blocked");
assert.equal(blockedEvent.authorization_status, "not_applicable");
assert.equal(blockedEvent.world_truth_is_not_character_knowledge, true);
assert.equal(blockedEvent.character_knowledge_updated, false);
assert.equal(blockedEvent.alternative_means_generated, false);
assert.equal(blockedEvent.goal_state_mutated, false);
assert.equal(blockedEvent.plan_lifecycle_mutated, false);
assert.equal(blockedEvent.same_turn_replanning_triggered, false);
assert.equal(blockedEvent.utility_score, null);
assert.equal(blockedEvent.success_probability, null);
assert.equal(blockedEvent.feasibility_score, null);

const blockedQueue = buildPhase72Queue(world, BLOCKED_TURN, blockedBuilt);
const projectedBlocked = projectWorldSimulationChronologicalMutationQueue({
  world_state: world,
  preview_world_state: blockedBuilt.result.preview_world_state,
  queue: blockedQueue,
});
assert.equal(projectedBlocked.projected_world_state.goal_implementation_intention_means_feasibility_history.length, 1);
const blockedExecution = executeWorldSimulationChronologicalMutationQueue({
  world_state: world,
  preview_world_state: blockedBuilt.result.preview_world_state,
  queue: blockedQueue,
});
world = blockedExecution.next_world_state;

const executionAfterBlocked = projectWorldSimulationEffectiveGoalImplementationIntentionExecution({ world_state: world });
assert.equal(executionAfterBlocked.plans_by_character[CHARACTER][plan.implementation_intention_id].state, "active");
assert.equal(world.motivational_goal_events[committed.goal_event_id].operation, "commit");
assert.equal(Object.values(world.motivational_goal_events).some((event) => event.operation === "abandon"), false);
assert.equal(world.goal_implementation_intention_revision_events, undefined);
assert.equal(world.goal_implementation_intention_adaptive_replanning_events, undefined);

// Complete positive coverage is required before the overall means may be called feasible.
const INCOMPLETE_TURN = "phase72_incomplete_turn";
const incompleteView = makeResolverView(world, INCOMPLETE_TURN, { result: "available" });
const incompleteOutcome = incompleteView.authoritative_evidence.find((entry) => entry.evidence_kind === "action_outcome");
const incompleteBuilt = buildFeasibility(world, INCOMPLETE_TURN, incompleteView, {
  source_plan_ref: incompleteView.source_plans[0].source_plan_ref,
  coverage_complete: false,
  constraint_checks: [{
    constraint_kind: "environment",
    constraint_code: "window_route_available",
    constraint_status: "satisfied",
    evidence_refs: [incompleteOutcome.evidence_ref],
  }],
});
const incompleteEvent = incompleteBuilt.result.means_feasibility_events_created[0];
assert.equal(incompleteEvent.means_status, "indeterminate");
assert.equal(incompleteEvent.physical_executability, "executable");
assert.equal(incompleteEvent.authorization_status, "not_applicable");

// Permission evidence alone cannot prove physical executability, even when the
// evaluator marks its declared constraint list complete.
const PERMISSION_ONLY_TURN = "phase72_permission_only_turn";
const permissionOnlyView = makeResolverView(world, PERMISSION_ONLY_TURN, { result: "available" });
const permissionOnlyOutcome = permissionOnlyView.authoritative_evidence.find((entry) => entry.evidence_kind === "action_outcome");
const permissionOnlyBuilt = buildFeasibility(world, PERMISSION_ONLY_TURN, permissionOnlyView, {
  source_plan_ref: permissionOnlyView.source_plans[0].source_plan_ref,
  coverage_complete: true,
  constraint_checks: [{
    constraint_kind: "permission",
    constraint_code: "research_room_access_authorized",
    constraint_status: "satisfied",
    evidence_refs: [permissionOnlyOutcome.evidence_ref],
  }],
});
const permissionOnlyEvent = permissionOnlyBuilt.result.means_feasibility_events_created[0];
assert.equal(permissionOnlyEvent.means_status, "indeterminate");
assert.equal(permissionOnlyEvent.physical_executability, "indeterminate");
assert.equal(permissionOnlyEvent.authorization_status, "authorized");

// Permission denial remains distinct from physical impossibility.
const PERMISSION_TURN = "phase72_permission_turn";
const permissionView = makeResolverView(world, PERMISSION_TURN, { result: "available" });
const permissionOutcome = permissionView.authoritative_evidence.find((entry) => entry.evidence_kind === "action_outcome");
const permissionBuilt = buildFeasibility(world, PERMISSION_TURN, permissionView, {
  source_plan_ref: permissionView.source_plans[0].source_plan_ref,
  coverage_complete: true,
  constraint_checks: [
    {
      constraint_kind: "environment",
      constraint_code: "window_route_physically_available",
      constraint_status: "satisfied",
      evidence_refs: [permissionOutcome.evidence_ref],
    },
    {
      constraint_kind: "permission",
      constraint_code: "restricted_research_room_access",
      constraint_status: "unsatisfied",
      evidence_refs: [permissionOutcome.evidence_ref],
    },
  ],
});
const permissionEvent = permissionBuilt.result.means_feasibility_events_created[0];
assert.equal(permissionEvent.means_status, "blocked");
assert.equal(permissionEvent.physical_executability, "executable");
assert.equal(permissionEvent.authorization_status, "denied");

// Unknown means indeterminate, not blocked.
const UNKNOWN_TURN = "phase72_unknown_turn";
const unknownView = makeResolverView(world, UNKNOWN_TURN, { result: "available" });
const unknownBuilt = buildFeasibility(world, UNKNOWN_TURN, unknownView, {
  source_plan_ref: unknownView.source_plans[0].source_plan_ref,
  coverage_complete: true,
  constraint_checks: [{
    constraint_kind: "resource",
    constraint_code: "required_tool_availability_unknown",
    constraint_status: "unknown",
    evidence_refs: [],
  }],
});
assert.equal(unknownBuilt.result.means_feasibility_events_created[0].means_status, "indeterminate");
assert.equal(unknownBuilt.result.means_feasibility_events_created[0].physical_executability, "indeterminate");

const forgedTurn = "phase72_forged_evidence";
const forgedView = makeResolverView(world, forgedTurn);
assert.throws(
  () => buildFeasibility(world, forgedTurn, forgedView, {
    source_plan_ref: forgedView.source_plans[0].source_plan_ref,
    coverage_complete: true,
    constraint_checks: [{
      constraint_kind: "environment",
      constraint_code: "forged_world_fact",
      constraint_status: "unsatisfied",
      evidence_refs: ["phase72_evidence_forged"],
    }],
  }),
  (error) => error?.code === "WORLD_SIMULATION_MEANS_FEASIBILITY_EVIDENCE_OUT_OF_CONTEXT",
);

const foreignTurn = "phase72_cross_character";
const foreignView = makeResolverView(world, foreignTurn, { actor: OTHER_CHARACTER, result: "blocked" });
const foreignEvidence = foreignView.authoritative_evidence.find((entry) => entry.evidence_kind === "action_outcome");
assert.throws(
  () => buildFeasibility(world, foreignTurn, foreignView, {
    source_plan_ref: foreignView.source_plans[0].source_plan_ref,
    coverage_complete: true,
    constraint_checks: [{
      constraint_kind: "environment",
      constraint_code: "foreign_character_result",
      constraint_status: "unsatisfied",
      evidence_refs: [foreignEvidence.evidence_ref],
    }],
  }),
  (error) => error?.code === "WORLD_SIMULATION_MEANS_FEASIBILITY_CROSS_CHARACTER_EVIDENCE_FORBIDDEN",
);

const visibleTurn = "phase72_visible_subset";
const visibleView = makeResolverView(world, visibleTurn);
assert.throws(
  () => buildFeasibility(world, visibleTurn, visibleView, {
    source_plan_ref: visibleView.source_plans[0].source_plan_ref,
    coverage_complete: true,
    constraint_checks: [{
      constraint_kind: "resource",
      constraint_code: "unknown_resource",
      constraint_status: "unknown",
      evidence_refs: [],
    }],
    character_visible_evidence_refs: ["phase72_evidence_not_used"],
  }),
  (error) => error?.code === "WORLD_SIMULATION_MEANS_FEASIBILITY_CHARACTER_VISIBLE_EVIDENCE_INVALID",
);

// Phase62K requires authoritative context in both projection and execution.
const GUARD_TURN = "phase72_context_guard";
const guardView = makeResolverView(world, GUARD_TURN);
const guardOutcome = guardView.authoritative_evidence.find((entry) => entry.evidence_kind === "action_outcome");
const guardBuilt = buildFeasibility(world, GUARD_TURN, guardView, {
  source_plan_ref: guardView.source_plans[0].source_plan_ref,
  coverage_complete: true,
  constraint_checks: [{
    constraint_kind: "environment",
    constraint_code: "route_blocked_again",
    constraint_status: "unsatisfied",
    evidence_refs: [guardOutcome.evidence_ref],
  }],
});
const noContextQueue = buildPhase72Queue(world, GUARD_TURN, guardBuilt, null);
assert.throws(
  () => projectWorldSimulationChronologicalMutationQueue({
    world_state: world,
    preview_world_state: guardBuilt.result.preview_world_state,
    queue: noContextQueue,
  }),
  (error) => error?.code === "WORLD_SIMULATION_MEANS_FEASIBILITY_VALIDATION_CONTEXT_REQUIRED",
);
assert.throws(
  () => executeWorldSimulationChronologicalMutationQueue({
    world_state: world,
    preview_world_state: guardBuilt.result.preview_world_state,
    queue: noContextQueue,
  }),
  (error) => error?.code === "WORLD_SIMULATION_MEANS_FEASIBILITY_VALIDATION_CONTEXT_REQUIRED",
);

// Rebinding evidence-character metadata is rejected even if the outer context hash is recomputed.
const tamperedContext = clone(guardBuilt.result.authoritative_validation_context);
tamperedContext.authoritative_evidence.find((entry) => entry.evidence_ref === guardOutcome.evidence_ref).evidence_character = OTHER_CHARACTER;
const tamperedBody = clone(tamperedContext);
delete tamperedBody.context_hash;
tamperedContext.context_hash = hashAgentRunValue(tamperedBody);
const tamperedQueue = buildPhase72Queue(world, GUARD_TURN, guardBuilt, tamperedContext);
assert.throws(
  () => executeWorldSimulationChronologicalMutationQueue({
    world_state: world,
    preview_world_state: guardBuilt.result.preview_world_state,
    queue: tamperedQueue,
  }),
  (error) => error?.code === "WORLD_SIMULATION_MEANS_FEASIBILITY_VALIDATION_CONTEXT_INVALID",
);

const effectiveA = projectWorldSimulationEffectiveMeansFeasibility({ world_state: world });
const effectiveB = projectWorldSimulationEffectiveMeansFeasibility({ world_state: clone(world) });
assert.equal(effectiveA.projection_hash, effectiveB.projection_hash);
assert.equal(effectiveA.replayed_feasibility_event_count, 1);
assert.equal(
  effectiveA.latest_by_character[CHARACTER][plan.implementation_intention_id].means_status,
  "blocked",
);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const loopSource = fs.readFileSync(
  path.resolve(__dirname, "../../server/src/world-simulation-loop-service.mjs"),
  "utf8",
);
const adaptiveIndex = loopSource.indexOf("const adaptiveReplanningDecisionResolution =");
const feasibilityIndex = loopSource.indexOf("const meansFeasibilityDecisionResolution =", adaptiveIndex);
const commitIndex = loopSource.indexOf("commitWorldSimulationTurn", feasibilityIndex);
const postCommitIndex = loopSource.indexOf("let committedCurrentMindDelivery", commitIndex);
assert.ok(
  adaptiveIndex >= 0
    && feasibilityIndex > adaptiveIndex
    && commitIndex > feasibilityIndex
    && postCommitIndex > commitIndex,
  "Phase72 must run after Phase71 and before atomic world commit.",
);
assert.match(
  loopSource.slice(feasibilityIndex, commitIndex),
  /resolveMeansFeasibilityDecisions\(\s*adaptiveReplanningMutationExecution\.next_world_state/,
);
assert.match(
  loopSource.slice(commitIndex, postCommitIndex),
  /visibleConstraintObservationMutationExecution\.next_world_state/,
);
assert.doesNotMatch(
  loopSource.slice(feasibilityIndex, commitIndex),
  /adaptiveReplanningCandidateProvider|goalViabilityResolver|expectedUtility|successProbability|reinforcementLearning/i,
);

console.log("Phase72 means feasibility / capability-affordance validation tests passed.");
