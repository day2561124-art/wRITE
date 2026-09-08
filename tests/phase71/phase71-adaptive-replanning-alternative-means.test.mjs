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
} from "../../server/src/world-simulation-goal-to-plan-implementation-intention-service.mjs";
import {
  buildWorldSimulationGoalImplementationIntentionExecutionFeedback,
  buildWorldSimulationGoalImplementationIntentionExecutionFeedbackResolverView,
} from "../../server/src/world-simulation-goal-implementation-intention-execution-feedback-service.mjs";
import {
  projectWorldSimulationEffectiveRevisedGoalImplementationIntentions,
} from "../../server/src/world-simulation-goal-implementation-intention-revision-service.mjs";
import {
  buildWorldSimulationAdaptiveReplanningContract,
  buildWorldSimulationAdaptiveReplanningEvents,
  buildWorldSimulationAdaptiveReplanningResolverView,
  projectWorldSimulationEffectiveAdaptiveReplanning,
  worldSimulationAdaptiveReplanningVersion,
} from "../../server/src/world-simulation-adaptive-replanning-service.mjs";

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
function makeGoalEvent({ character, goalId, turnId, operation, previous = null }) {
  const event = {
    schema_version: motivationalGoalEventSchemaVersion,
    version: worldSimulationMotivationGoalIntegrationVersion,
    immutable: true,
    character,
    source_turn_id: turnId,
    operation,
    goal_id: goalId,
    goal_kind: "achieve_state",
    domain: "academy_task",
    target_descriptor: {
      label: "reach_training_observation_point",
      context: "phase71_acceptance",
    },
    motivation_basis_refs: [{
      source_kind: "phase68b_structured_self_model_aspect_event",
      source_event_id: "phase71_source_aspect",
      source_event_hash: "phase71_source_aspect_hash",
    }],
    motivation_relations: ["self_concordant_with"],
    resolver_view_hash: `phase71_goal_resolver_${turnId}`,
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
  return {
    queue,
    execution: executeWorldSimulationChronologicalMutationQueue({
      world_state: world,
      preview_world_state: built.result.preview_world_state,
      queue,
    }),
  };
}
function addFeedback(world, turnId, operation = "failed") {
  const selected = {
    character: CHARACTER,
    action_id: `phase71_action_${turnId}`,
    intent: "attempt_direct_route",
  };
  const outcome = {
    actor: CHARACTER,
    action_id: selected.action_id,
    result: operation === "failed" ? "route_remained_blocked" : "route_progressed",
    causal_evidence: `authoritative_outcome_${turnId}`,
  };
  const resolverView = buildWorldSimulationGoalImplementationIntentionExecutionFeedbackResolverView({
    world_state: world,
    turn_id: turnId,
    selected_action_intents: [selected],
    action_outcomes: [outcome],
  });
  const feedbackPlan = resolverView.plans.find((plan) =>
    plan.implementation_intention_id === sourcePlan.implementation_intention_id);
  assert.ok(feedbackPlan, "Phase71 fixture must resolve the repeatedly attempted source plan.");
  const built = buildWorldSimulationGoalImplementationIntentionExecutionFeedback({
    world_state: world,
    turn_id: turnId,
    resolver_view: resolverView,
    feedback_decisions: [{
      plan_ref: feedbackPlan.plan_ref,
      operation,
      reason: `phase71_test_${operation}`,
    }],
  });
  return executeBuilt(
    world,
    turnId,
    "goal_implementation_intention_execution_feedback",
    built,
  ).execution.next_world_state;
}
function withCandidate(world, turnId, sourcePlanRef) {
  const groundingView = buildWorldSimulationAdaptiveReplanningResolverView({
    world_state: world,
    turn_id: turnId,
    alternative_means_candidates: [],
  });
  const representedAlternative = groundingView.means_grounding_catalog.find((grounding) =>
    grounding.source_plan_ref === sourcePlanRef
    && grounding.grounding_kind === "represented_same_goal_means");
  assert.ok(
    representedAlternative,
    "Phase71 replacement fixture must be grounded by a separately represented same-goal means.",
  );
  return buildWorldSimulationAdaptiveReplanningResolverView({
    world_state: world,
    turn_id: turnId,
    alternative_means_candidates: [{
      source_plan_ref: sourcePlanRef,
      candidate_kind: "replace_means",
      means_grounding_refs: [representedAlternative.grounding_ref],
      replacement_cue_descriptor: {
        cue_kind: "obstacle",
        label: "direct_route_blocked_repeatedly",
        context: "use_only_known_local_alternative",
      },
      replacement_response_descriptor: {
        response_kind: "seek_support",
        label: "ask_known_companion_for_alternate_access",
        context: "planning_only_no_action_authority",
      },
    }],
  });
}

const CHARACTER = "伊萊亞斯・諾爾";
const GOAL_ID = "phase71_same_goal_001";
const PLAN_TURN = "phase71_plan_formation";
const ALTERNATIVE_PLAN_TURN = "phase71_alternative_plan_formation";
const REPLAN_TURN = "phase71_replan_turn";

const proposed = makeGoalEvent({
  character: CHARACTER,
  goalId: GOAL_ID,
  turnId: "phase71_goal_propose",
  operation: "propose",
});
const committed = makeGoalEvent({
  character: CHARACTER,
  goalId: GOAL_ID,
  turnId: "phase71_goal_commit",
  operation: "commit",
  previous: proposed,
});
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
      label: "direct_route_is_blocked",
      context: "academy_training_area",
    },
    response_descriptor: {
      response_kind: "cognitive_procedure",
      label: "attempt_direct_route",
      context: "planning_only",
    },
    resolver_view_hash: planResolver.resolver_view_hash,
  }],
});
world = executeBuilt(world, PLAN_TURN, "goal_implementation_intention", planBuilt)
  .execution.next_world_state;
const sourcePlan = planBuilt.result.implementation_intention_events_created[0];

const alternativePlanResolver = buildWorldSimulationGoalImplementationIntentionResolverView({
  world_state: world,
  turn_id: ALTERNATIVE_PLAN_TURN,
});
const alternativePlanBuilt = buildWorldSimulationGoalImplementationIntentionEvents({
  world_state: world,
  turn_id: ALTERNATIVE_PLAN_TURN,
  implementation_intention_decisions: [{
    character: CHARACTER,
    goal_id: GOAL_ID,
    cue_descriptor: {
      cue_kind: "obstacle",
      label: "direct_route_requires_alternate_access",
      context: "academy_training_area",
    },
    response_descriptor: {
      response_kind: "seek_support",
      label: "ask_known_companion_for_alternate_access",
      context: "represented_same_goal_alternative",
    },
    resolver_view_hash: alternativePlanResolver.resolver_view_hash,
  }],
});
world = executeBuilt(
  world,
  ALTERNATIVE_PLAN_TURN,
  "goal_implementation_intention",
  alternativePlanBuilt,
).execution.next_world_state;
const representedAlternativePlan = alternativePlanBuilt.result.implementation_intention_events_created[0];
assert.equal(representedAlternativePlan.goal_id, GOAL_ID);

const contract = buildWorldSimulationAdaptiveReplanningContract();
assert.equal(contract.phase, "Phase71");
assert.equal(contract.version, worldSimulationAdaptiveReplanningVersion);
assert.equal(contract.same_goal_different_means, true);
assert.equal(contract.goal_commitment_preserved, true);
assert.equal(contract.phase69b_revision_owns_plan_supersession_and_replacement_identity, true);
assert.equal(contract.minimum_consecutive_failure_turns, 2);
assert.equal(contract.single_action_failure_sufficient, false);
assert.equal(contract.single_plan_failure_event_sufficient, false);
assert.equal(contract.candidate_generation_and_selection_separated, true);
assert.equal(contract.bounded_character_means_grounding_catalog_required, true);
assert.equal(contract.candidate_character_cognition_grounding_required, true);
assert.equal(contract.replace_means_requires_grounding_beyond_failed_current_means, true);
assert.equal(contract.represented_same_goal_means_must_be_nonterminal, true);
assert.equal(contract.new_goal_creation_modeled, false);
assert.equal(contract.automatic_goal_abandonment_modeled, false);
assert.equal(contract.goal_unattainability_verification_modeled, false);
assert.equal(contract.goal_disengagement_reengagement_modeled, false);
assert.equal(contract.arbitrary_world_state_search_modeled, false);
assert.equal(contract.expected_utility_optimizer_modeled, false);
assert.equal(contract.authoritative_mutation_owner, "phase62k-authoritative-mutation-executor-v1");

const queueContract = buildWorldSimulationChronologicalMutationQueueContract();
assert.equal(queueContract.execution.phase71_adaptive_replanning_event_write_once_enforced, true);
assert.equal(queueContract.execution.phase71_same_character_same_goal_phase69b_revision_provenance_enforced, true);
assert.equal(
  queueContract.execution
    .phase71_prior_committed_consecutive_failure_evidence_required_for_failure_basis,
  true,
);
assert.equal(
  queueContract.execution
    .phase71_prior_committed_subjective_means_block_is_alternative_eligibility_basis,
  true,
);
assert.equal(
  queueContract.execution.phase71_same_turn_subjective_belief_feedback_rejected,
  true,
);
assert.equal(
  queueContract.execution
    .phase71_uncertain_or_perceived_feasible_subjective_assessment_auto_trigger_rejected,
  true,
);
assert.equal(queueContract.execution.phase71_single_action_failure_replanning_rejected, true);
assert.equal(queueContract.execution.phase71_bounded_candidate_membership_verified, true);
assert.equal(queueContract.execution.phase71_bounded_character_means_grounding_catalog_verified, true);
assert.equal(queueContract.execution.phase71_grounding_content_address_verified, true);
assert.equal(queueContract.execution.phase71_grounding_source_revalidated_against_committed_cognition, true);
assert.equal(queueContract.execution.phase71_cross_character_or_cross_source_grounding_rejected, true);
assert.equal(queueContract.execution.phase71_replace_means_requires_grounding_beyond_failed_current_means, true);
assert.equal(queueContract.execution.phase71_authoritative_queue_validator_invoked, true);

// One committed failure is explicitly insufficient.
world = addFeedback(world, "phase71_failure_001", "failed");
const oneFailureView = buildWorldSimulationAdaptiveReplanningResolverView({
  world_state: world,
  turn_id: "phase71_after_one_failure",
  alternative_means_candidates: [],
});
assert.equal(oneFailureView.eligible_source_plans.length, 0);
assert.equal(oneFailureView.single_action_failure_sufficient, false);
assert.equal(oneFailureView.single_plan_failure_event_sufficient, false);

// Even a second failure from the current turn may not be counted retroactively.
const sameTurnSecondFailureWorld = addFeedback(clone(world), REPLAN_TURN, "failed");
const sameTurnExcludedView = buildWorldSimulationAdaptiveReplanningResolverView({
  world_state: sameTurnSecondFailureWorld,
  turn_id: REPLAN_TURN,
  alternative_means_candidates: [],
});
assert.equal(
  sameTurnExcludedView.eligible_source_plans.length,
  0,
  "Phase71 must exclude same-turn Phase69D failure when evaluating the prior committed failure streak.",
);

// Two failures from distinct prior committed turns make the same goal/current means eligible.
world = addFeedback(world, "phase71_failure_002", "failed");
const sourceView = buildWorldSimulationAdaptiveReplanningResolverView({
  world_state: world,
  turn_id: REPLAN_TURN,
  alternative_means_candidates: [],
});
assert.equal(sourceView.eligible_source_plans.length, 1);
const eligibleSource = sourceView.eligible_source_plans[0];
assert.equal(eligibleSource.character, CHARACTER);
assert.equal(eligibleSource.goal_id, GOAL_ID);
assert.equal(eligibleSource.source_implementation_intention_id, sourcePlan.implementation_intention_id);
assert.equal(eligibleSource.consecutive_failure_count, 2);
assert.deepEqual(
  eligibleSource.failure_evidence_refs.map((ref) => ref.operation),
  ["failed", "failed"],
);
assert.equal(new Set(eligibleSource.failure_evidence_refs.map((ref) => ref.source_turn_id)).size, 2);
const currentMeansGrounding = sourceView.means_grounding_catalog.find((grounding) =>
  grounding.source_plan_ref === eligibleSource.source_plan_ref
  && grounding.grounding_kind === "current_implementation_intention");
const representedMeansGrounding = sourceView.means_grounding_catalog.find((grounding) =>
  grounding.source_plan_ref === eligibleSource.source_plan_ref
  && grounding.grounding_kind === "represented_same_goal_means"
  && grounding.source_event_id === representedAlternativePlan.implementation_intention_event_id);
assert.ok(currentMeansGrounding);
assert.ok(representedMeansGrounding);
assert.equal(representedMeansGrounding.character, CHARACTER);
assert.equal(representedMeansGrounding.goal_id, GOAL_ID);
assert.equal(
  representedMeansGrounding.character_view.response_descriptor.label,
  "ask_known_companion_for_alternate_access",
);
assert.equal(sourceView.provider_receives_only_bounded_character_means_grounding_catalog, true);
assert.equal(sourceView.candidate_must_cite_character_means_grounding_refs, true);
assert.equal(sourceView.replace_means_requires_grounding_beyond_failed_current_means, true);

// A candidate cannot invent a grounding ref outside the bounded character-cognition catalog.
assert.throws(
  () => buildWorldSimulationAdaptiveReplanningResolverView({
    world_state: world,
    turn_id: REPLAN_TURN,
    alternative_means_candidates: [{
      source_plan_ref: eligibleSource.source_plan_ref,
      candidate_kind: "replace_means",
      means_grounding_refs: ["phase71_grounding_forged"],
      replacement_cue_descriptor: {
        cue_kind: "obstacle",
        label: "direct_route_blocked_repeatedly",
        context: "forged_grounding_must_fail",
      },
      replacement_response_descriptor: {
        response_kind: "seek_support",
        label: "invent_unrepresented_helper",
        context: "not_character_grounded",
      },
    }],
  }),
  (error) => error?.code === "WORLD_SIMULATION_ADAPTIVE_REPLANNING_GROUNDING_OUT_OF_CONTEXT",
);

// replace_means cannot cite only the repeatedly failed current means as its grounding.
assert.throws(
  () => buildWorldSimulationAdaptiveReplanningResolverView({
    world_state: world,
    turn_id: REPLAN_TURN,
    alternative_means_candidates: [{
      source_plan_ref: eligibleSource.source_plan_ref,
      candidate_kind: "replace_means",
      means_grounding_refs: [currentMeansGrounding.grounding_ref],
      replacement_cue_descriptor: {
        cue_kind: "obstacle",
        label: "direct_route_blocked_repeatedly",
        context: "failed_current_means_only",
      },
      replacement_response_descriptor: {
        response_kind: "communication",
        label: "invented_replacement_without_new_grounding",
        context: "must_fail",
      },
    }],
  }),
  (error) => error?.code === "WORLD_SIMULATION_ADAPTIVE_REPLANNING_REPLACEMENT_GROUNDING_INSUFFICIENT",
);

// repair_existing_means may stay grounded in the represented current means, but must still change the cue/response pair.
const repairView = buildWorldSimulationAdaptiveReplanningResolverView({
  world_state: world,
  turn_id: REPLAN_TURN,
  alternative_means_candidates: [{
    source_plan_ref: eligibleSource.source_plan_ref,
    candidate_kind: "repair_existing_means",
    means_grounding_refs: [currentMeansGrounding.grounding_ref],
    replacement_cue_descriptor: {
      cue_kind: "task_juncture",
      label: "retry_direct_route_after_reassessment",
      context: "repair_same_represented_means",
    },
    replacement_response_descriptor: {
      response_kind: "cognitive_procedure",
      label: "resequence_direct_route_attempt",
      context: "repair_without_new_world_knowledge",
    },
  }],
});
assert.equal(repairView.alternative_means_candidates.length, 1);
assert.deepEqual(
  repairView.alternative_means_candidates[0].means_grounding_kinds,
  ["current_implementation_intention"],
);
assert.equal(repairView.alternative_means_candidates[0].character_cognition_grounded, true);

// Unchanged means are not a replan.
assert.throws(
  () => buildWorldSimulationAdaptiveReplanningResolverView({
    world_state: world,
    turn_id: REPLAN_TURN,
    alternative_means_candidates: [{
      source_plan_ref: eligibleSource.source_plan_ref,
      candidate_kind: "repair_existing_means",
      replacement_cue_descriptor: clone(eligibleSource.cue_descriptor),
      replacement_response_descriptor: clone(eligibleSource.response_descriptor),
    }],
  }),
  (error) => error?.code === "WORLD_SIMULATION_ADAPTIVE_REPLANNING_UNCHANGED_MEANS_FORBIDDEN",
);

const resolverView = withCandidate(world, REPLAN_TURN, eligibleSource.source_plan_ref);
assert.equal(resolverView.alternative_means_candidates.length, 1);
assert.equal(resolverView.raw_world_state_exposed, false);
assert.equal(resolverView.raw_memory_store_exposed, false);
assert.equal(resolverView.numeric_scoring_requested, false);
const candidate = resolverView.alternative_means_candidates[0];
assert.equal(candidate.goal_id, GOAL_ID);
assert.equal(candidate.source_implementation_intention_id, sourcePlan.implementation_intention_id);
assert.equal(candidate.bounded_source_view_only, true);
assert.equal(candidate.character_cognition_grounded, true);
assert.deepEqual(candidate.means_grounding_refs, [representedMeansGrounding.grounding_ref]);
assert.deepEqual(candidate.means_grounding_kinds, ["represented_same_goal_means"]);
assert.equal(candidate.arbitrary_world_state_search_used, false);
assert.equal(candidate.objective_feasibility_verified, false);
assert.equal(candidate.utility_score, null);
assert.equal(candidate.success_probability, null);

assert.throws(
  () => buildWorldSimulationAdaptiveReplanningEvents({
    world_state: world,
    turn_id: REPLAN_TURN,
    resolver_view: resolverView,
    replanning_decisions: [{
      source_plan_ref: eligibleSource.source_plan_ref,
      candidate_ref: "phase71_candidate_forged",
    }],
  }),
  (error) => error?.code === "WORLD_SIMULATION_ADAPTIVE_REPLANNING_DECISION_OUT_OF_CONTEXT",
);

assert.throws(
  () => buildWorldSimulationAdaptiveReplanningEvents({
    world_state: world,
    turn_id: REPLAN_TURN,
    resolver_view: resolverView,
    replanning_decisions: [
      {
        source_plan_ref: eligibleSource.source_plan_ref,
        candidate_ref: candidate.candidate_ref,
      },
      {
        source_plan_ref: eligibleSource.source_plan_ref,
        candidate_ref: candidate.candidate_ref,
      },
    ],
  }),
  (error) => error?.code === "WORLD_SIMULATION_ADAPTIVE_REPLANNING_PER_SOURCE_TURN_LIMIT",
);

// Simulate the real loop: current-turn Phase69D feedback may already be in the
// post-70C preview, but Phase71's resolver catalog and durable failure refs are
// still pinned only to the two failures committed before this turn.
const postFeedbackWorld = addFeedback(clone(world), REPLAN_TURN, "failed");
const builtA = buildWorldSimulationAdaptiveReplanningEvents({
  world_state: postFeedbackWorld,
  turn_id: REPLAN_TURN,
  resolver_view: resolverView,
  replanning_decisions: [{
    source_plan_ref: eligibleSource.source_plan_ref,
    candidate_ref: candidate.candidate_ref,
  }],
});
const builtB = buildWorldSimulationAdaptiveReplanningEvents({
  world_state: clone(postFeedbackWorld),
  turn_id: REPLAN_TURN,
  resolver_view: clone(resolverView),
  replanning_decisions: [{
    source_plan_ref: eligibleSource.source_plan_ref,
    candidate_ref: candidate.candidate_ref,
  }],
});
assert.equal(builtA.result.replanning_decision_count, 1);
assert.equal(builtA.result.phase69b_revision_events_created.length, 1);
assert.equal(builtA.result.adaptive_replanning_events_created.length, 1);
assert.equal(
  builtA.result.adaptive_replanning_events_created[0].adaptive_replanning_event_hash,
  builtB.result.adaptive_replanning_events_created[0].adaptive_replanning_event_hash,
  "Equivalent prior committed evidence and candidate choices must replay deterministically.",
);
const revisionEvent = builtA.result.phase69b_revision_events_created[0];
const replanningEvent = builtA.result.adaptive_replanning_events_created[0];
assert.equal(revisionEvent.operation, "revise");
assert.equal(revisionEvent.goal_id, GOAL_ID);
assert.equal(revisionEvent.target_implementation_intention_id, sourcePlan.implementation_intention_id);
assert.notEqual(revisionEvent.replacement_implementation_intention_id, sourcePlan.implementation_intention_id);
assert.equal(replanningEvent.goal_id, GOAL_ID);
assert.equal(replanningEvent.same_goal_preserved, true);
assert.equal(replanningEvent.new_goal_created, false);
assert.equal(replanningEvent.goal_state_mutated, false);
assert.equal(replanningEvent.goal_unattainability_asserted, false);
assert.equal(replanningEvent.goal_disengagement_asserted, false);
assert.equal(replanningEvent.consecutive_failure_count, 2);
assert.equal(replanningEvent.failure_evidence_refs.length, 2);
assert.deepEqual(replanningEvent.means_grounding_refs, [representedMeansGrounding.grounding_ref]);
assert.deepEqual(replanningEvent.means_grounding_kinds, ["represented_same_goal_means"]);
assert.equal(replanningEvent.character_cognition_grounded, true);
assert.equal(replanningEvent.bounded_character_means_grounding_catalog_only, true);
assert.equal(replanningEvent.replacement_means_not_invented_from_raw_world_state, true);
assert.equal(
  replanningEvent.failure_evidence_refs.some((ref) => ref.source_turn_id === REPLAN_TURN),
  false,
  "Current-turn Phase69D feedback must not become Phase71 reconsideration evidence.",
);

const phase69bQueue = buildWorldSimulationChronologicalMutationQueue({
  turn_id: `${REPLAN_TURN}:goal_implementation_intention_revision`,
  world_state_hash: hashAgentRunValue(postFeedbackWorld),
  state_transitions: builtA.result.phase69b_revision_state_transitions,
  elapsed_ms: 0,
});
const afterRevision = executeWorldSimulationChronologicalMutationQueue({
  world_state: postFeedbackWorld,
  preview_world_state: builtA.result.phase69b_preview_world_state,
  queue: phase69bQueue,
}).next_world_state;

const phase71Queue = buildWorldSimulationChronologicalMutationQueue({
  turn_id: `${REPLAN_TURN}:adaptive_replanning_alternative_means`,
  world_state_hash: hashAgentRunValue(afterRevision),
  state_transitions: builtA.result.state_transitions,
  validation_context: {
    adaptive_replanning_alternative_means: builtA.result.authoritative_validation_context,
  },
  elapsed_ms: 0,
});
const afterReplan = executeWorldSimulationChronologicalMutationQueue({
  world_state: afterRevision,
  preview_world_state: builtA.result.preview_world_state,
  queue: phase71Queue,
}).next_world_state;

const revisedProjection = projectWorldSimulationEffectiveRevisedGoalImplementationIntentions({
  world_state: afterReplan,
});
const revisedPlans = revisedProjection.plans_by_character[CHARACTER];
assert.equal(revisedPlans[sourcePlan.implementation_intention_id].state, "superseded");
assert.equal(
  revisedPlans[sourcePlan.implementation_intention_id].replacement_implementation_intention_id,
  revisionEvent.replacement_implementation_intention_id,
);
assert.equal(revisedPlans[revisionEvent.replacement_implementation_intention_id].state, "active");
assert.equal(revisedPlans[revisionEvent.replacement_implementation_intention_id].goal_id, GOAL_ID);
assert.equal(afterReplan.motivational_goal_events[committed.goal_event_id].operation, "commit");
assert.equal(
  Object.values(afterReplan.motivational_goal_events).some((event) => event.operation === "abandon"),
  false,
);

const effectiveA = projectWorldSimulationEffectiveAdaptiveReplanning({ world_state: afterReplan });
const effectiveB = projectWorldSimulationEffectiveAdaptiveReplanning({ world_state: clone(afterReplan) });
assert.equal(effectiveA.projection_hash, effectiveB.projection_hash);
assert.equal(effectiveA.replayed_replanning_event_count, 1);

// The superseded source cannot churn into a second Phase71 replan, and the new
// replacement begins without inherited failure evidence.
const laterView = buildWorldSimulationAdaptiveReplanningResolverView({
  world_state: afterReplan,
  turn_id: "phase71_later_turn",
  alternative_means_candidates: [],
});
assert.equal(laterView.eligible_source_plans.length, 0);

// Phase62K independently rejects missing/tampered candidate-membership context.
const noContextQueue = buildWorldSimulationChronologicalMutationQueue({
  turn_id: `${REPLAN_TURN}:adaptive_replanning_alternative_means`,
  world_state_hash: hashAgentRunValue(afterRevision),
  state_transitions: builtA.result.state_transitions,
  elapsed_ms: 0,
});
assert.throws(
  () => executeWorldSimulationChronologicalMutationQueue({
    world_state: afterRevision,
    preview_world_state: builtA.result.preview_world_state,
    queue: noContextQueue,
  }),
  (error) => error?.code === "WORLD_SIMULATION_ADAPTIVE_REPLANNING_VALIDATION_CONTEXT_REQUIRED",
);
const tamperedContext = clone(builtA.result.authoritative_validation_context);
tamperedContext.alternative_means_candidates[0].candidate_hash = "forged_candidate_hash";
const contextBody = clone(tamperedContext);
delete contextBody.context_hash;
tamperedContext.context_hash = hashAgentRunValue(contextBody);
const tamperedQueue = buildWorldSimulationChronologicalMutationQueue({
  turn_id: `${REPLAN_TURN}:adaptive_replanning_alternative_means`,
  world_state_hash: hashAgentRunValue(afterRevision),
  state_transitions: builtA.result.state_transitions,
  validation_context: {
    adaptive_replanning_alternative_means: tamperedContext,
  },
  elapsed_ms: 0,
});
assert.throws(
  () => executeWorldSimulationChronologicalMutationQueue({
    world_state: afterRevision,
    preview_world_state: builtA.result.preview_world_state,
    queue: tamperedQueue,
  }),
  (error) => error?.code === "WORLD_SIMULATION_ADAPTIVE_REPLANNING_CANDIDATE_OUT_OF_CONTEXT",
);

// A grounding ref cannot be rebound to another source plan even if the outer
// validation-context hash is recomputed after tampering.
const crossSourceContext = clone(builtA.result.authoritative_validation_context);
const selectedGrounding = crossSourceContext.means_grounding_catalog.find((grounding) =>
  grounding.grounding_ref === candidate.means_grounding_refs[0]);
assert.ok(selectedGrounding);
selectedGrounding.source_plan_ref = "phase71_source_foreign";
const crossSourceBody = clone(crossSourceContext);
delete crossSourceBody.context_hash;
crossSourceContext.context_hash = hashAgentRunValue(crossSourceBody);
const crossSourceQueue = buildWorldSimulationChronologicalMutationQueue({
  turn_id: `${REPLAN_TURN}:adaptive_replanning_alternative_means`,
  world_state_hash: hashAgentRunValue(afterRevision),
  state_transitions: builtA.result.state_transitions,
  validation_context: {
    adaptive_replanning_alternative_means: crossSourceContext,
  },
  elapsed_ms: 0,
});
assert.throws(
  () => executeWorldSimulationChronologicalMutationQueue({
    world_state: afterRevision,
    preview_world_state: builtA.result.preview_world_state,
    queue: crossSourceQueue,
  }),
  (error) => error?.code === "WORLD_SIMULATION_ADAPTIVE_REPLANNING_GROUNDING_OUT_OF_CONTEXT",
);

// Phase62K revalidates the grounding against committed cognition rather than
// trusting a previously materialized context. Corrupting the represented
// alternative's durable Phase69A source must invalidate the Phase71 commit.
const corruptedGroundingWorld = clone(afterRevision);
corruptedGroundingWorld.goal_implementation_intention_events[
  representedAlternativePlan.implementation_intention_event_id
].response_descriptor.label = "tampered_after_context_materialization";
const corruptedGroundingQueue = buildWorldSimulationChronologicalMutationQueue({
  turn_id: `${REPLAN_TURN}:adaptive_replanning_alternative_means`,
  world_state_hash: hashAgentRunValue(corruptedGroundingWorld),
  state_transitions: builtA.result.state_transitions,
  validation_context: {
    adaptive_replanning_alternative_means: builtA.result.authoritative_validation_context,
  },
  elapsed_ms: 0,
});
assert.throws(
  () => executeWorldSimulationChronologicalMutationQueue({
    world_state: corruptedGroundingWorld,
    preview_world_state: builtA.result.preview_world_state,
    queue: corruptedGroundingQueue,
  }),
  (error) => error?.code === "WORLD_SIMULATION_ADAPTIVE_REPLANNING_GROUNDING_SOURCE_INVALID",
);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const loopSource = fs.readFileSync(
  path.resolve(__dirname, "../../server/src/world-simulation-loop-service.mjs"),
  "utf8",
);
const feedbackIndex = loopSource.indexOf("const implementationIntentionExecutionFeedbackDecisionResolution =");
const achievementIndex = loopSource.indexOf("const goalAchievementDecisionResolution =", feedbackIndex);
const viabilityIndex = loopSource.indexOf("const goalViabilityDecisionResolution =", achievementIndex);
const adjustmentIndex = loopSource.indexOf("const goalAdjustmentDecisionResolution =", viabilityIndex);
const adaptiveIndex = loopSource.indexOf("const adaptiveReplanningDecisionResolution =", adjustmentIndex);
const meansFeasibilityIndex = loopSource.indexOf("const meansFeasibilityDecisionResolution =", adaptiveIndex);
const commitIndex = loopSource.indexOf("commitWorldSimulationTurn", meansFeasibilityIndex);
const postCommitIndex = loopSource.indexOf("let committedCurrentMindDelivery", commitIndex);
assert.ok(
  feedbackIndex >= 0
    && achievementIndex > feedbackIndex
    && viabilityIndex > achievementIndex
    && adjustmentIndex > viabilityIndex
    && adaptiveIndex > adjustmentIndex
    && meansFeasibilityIndex > adaptiveIndex
    && commitIndex > meansFeasibilityIndex
    && postCommitIndex > commitIndex,
  "Phase71 must run after Phase69D/70A/70B/70C and before downstream Phase72 and atomic world commit.",
);
assert.match(loopSource.slice(adaptiveIndex, meansFeasibilityIndex), /resolveAdaptiveReplanningDecisions\(\s*snapshot\.state/);
assert.match(loopSource.slice(meansFeasibilityIndex, commitIndex), /adaptiveReplanningMutationExecution\.next_world_state/);
assert.match(loopSource.slice(commitIndex, postCommitIndex), /visibleConstraintObservationMutationExecution\.next_world_state/);
assert.match(loopSource.slice(adaptiveIndex, meansFeasibilityIndex), /goal_implementation_intention_revision/);
assert.match(loopSource.slice(adaptiveIndex, meansFeasibilityIndex), /adaptive_replanning_alternative_means/);
assert.doesNotMatch(
  loopSource.slice(adaptiveIndex, commitIndex),
  /expectedUtility|successProbability|reinforcementLearning|scanWorldState/i,
);

console.log("Phase71 adaptive replanning / alternative means tests passed.");
