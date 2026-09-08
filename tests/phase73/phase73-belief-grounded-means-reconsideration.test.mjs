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
  buildWorldSimulationSubjectiveClaims,
} from "../../server/src/world-simulation-subjective-claim-projection-service.mjs";
import {
  resolveWorldSimulationSubjectiveBeliefs,
} from "../../server/src/world-simulation-subjective-belief-resolution-service.mjs";
import {
  buildWorldSimulationSubjectiveBeliefRevisions,
} from "../../server/src/world-simulation-subjective-belief-revision-service.mjs";
import {
  buildWorldSimulationSubjectiveMeansFeasibilityClaimProposals,
  buildWorldSimulationSubjectiveMeansFeasibilityResolverView,
} from "../../server/src/world-simulation-subjective-means-feasibility-interpretation-service.mjs";
import {
  buildWorldSimulationSubjectiveMeansFeasibilityLinkages,
  buildWorldSimulationSubjectiveMeansFeasibilityReconsiderationContract,
  projectWorldSimulationSubjectiveMeansReconsiderationTriggers,
  worldSimulationSubjectiveMeansFeasibilityReconsiderationVersion,
} from "../../server/src/world-simulation-subjective-means-feasibility-reconsideration-service.mjs";
import {
  buildWorldSimulationAdaptiveReplanningEvents,
  buildWorldSimulationAdaptiveReplanningResolverView,
  buildWorldSimulationAdaptiveReplanningContract,
} from "../../server/src/world-simulation-adaptive-replanning-service.mjs";
import {
  projectWorldSimulationEffectiveRevisedGoalImplementationIntentions,
} from "../../server/src/world-simulation-goal-implementation-intention-revision-service.mjs";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
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
      context: "phase73c_acceptance",
    },
    motivation_basis_refs: [{
      source_kind: "phase68b_structured_self_model_aspect_event",
      source_event_id: "phase73c_source_aspect",
      source_event_hash: "phase73c_source_aspect_hash",
    }],
    motivation_relations: ["self_concordant_with"],
    resolver_view_hash: `phase73c_goal_resolver_${turnId}`,
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
    goal_event_id: `phase73c_goal_event_${turnId}`,
  };
  event.goal_event_hash = goalHash(event);
  return event;
}
function executeBuilt(world, turnId, suffix, built, validationContext = null) {
  const queue = buildWorldSimulationChronologicalMutationQueue({
    turn_id: `${turnId}:${suffix}`,
    world_state_hash: hashAgentRunValue(world),
    state_transitions: built.result.state_transitions,
    ...(validationContext ? { validation_context: validationContext } : {}),
    elapsed_ms: 0,
  });
  const execution = executeWorldSimulationChronologicalMutationQueue({
    world_state: world,
    preview_world_state: built.result.preview_world_state,
    queue,
  });
  return {
    queue,
    execution,
    world_state: execution.next_world_state,
  };
}
function makeMemory(memoryId, turnId, content) {
  return {
    memory_id: memoryId,
    memory_type: "episodic_direct_perception",
    content,
    source: {
      kind: "direct_perception",
      sense: "other_senses",
    },
    internal_provenance: {
      turn_id: turnId,
      observation_hash: hashAgentRunValue(content),
      formation_version: "phase63a-subjective-memory-formation-v2",
    },
    possibly_incorrect: false,
    source_confused: false,
    subjective_memory_not_world_truth: true,
  };
}
function sourceRecord(character, memory) {
  return {
    character,
    memory_record: clone(memory),
  };
}
function addFailureFeedback(world, turnId) {
  const selected = {
    character: CHARACTER,
    action_id: `phase73c_action_${turnId}`,
    intent: "attempt_wall_route",
  };
  const outcome = {
    actor: CHARACTER,
    action_id: selected.action_id,
    result: "route_remained_blocked",
    causal_evidence: `phase73c_authoritative_outcome_${turnId}`,
  };
  const resolverView = buildWorldSimulationGoalImplementationIntentionExecutionFeedbackResolverView({
    world_state: world,
    turn_id: turnId,
    selected_action_intents: [selected],
    action_outcomes: [outcome],
  });
  const plan = resolverView.plans.find((entry) =>
    entry.implementation_intention_id === sourcePlan.implementation_intention_id);
  assert.ok(plan, "Phase73C precedence fixture must resolve the source plan.");
  const built = buildWorldSimulationGoalImplementationIntentionExecutionFeedback({
    world_state: world,
    turn_id: turnId,
    resolver_view: resolverView,
    feedback_decisions: [{
      plan_ref: plan.plan_ref,
      operation: "failed",
      reason: "phase73c_precedence_failure_fixture",
    }],
  });
  return executeBuilt(
    world,
    turnId,
    "goal_implementation_intention_execution_feedback",
    built,
  ).world_state;
}

const CHARACTER = "伊萊亞斯・諾爾";
const GOAL_ID = "phase73c_goal_001";
const INTERPRET_TURN = "phase73c_interpret_turn";
const REPLAN_TURN = "phase73c_later_replan_turn";

const proposed = makeGoalEvent({
  character: CHARACTER,
  goalId: GOAL_ID,
  turnId: "phase73c_goal_propose",
  operation: "propose",
});
const committed = makeGoalEvent({
  character: CHARACTER,
  goalId: GOAL_ID,
  turnId: "phase73c_goal_commit",
  operation: "commit",
  previous: proposed,
});
let baseWorld = {
  motivational_goal_events: {
    [proposed.goal_event_id]: proposed,
    [committed.goal_event_id]: committed,
  },
  motivational_goal_history: [goalRef(proposed), goalRef(committed)],
};

const planResolver = buildWorldSimulationGoalImplementationIntentionResolverView({
  world_state: baseWorld,
  turn_id: "phase73c_plan_formation",
});
const planBuilt = buildWorldSimulationGoalImplementationIntentionEvents({
  world_state: baseWorld,
  turn_id: "phase73c_plan_formation",
  implementation_intention_decisions: [{
    character: CHARACTER,
    goal_id: GOAL_ID,
    cue_descriptor: {
      cue_kind: "obstacle",
      label: "wall_route",
      context: "academy_training_area",
    },
    response_descriptor: {
      response_kind: "initiate_behavior",
      label: "climb_wall",
      context: "represented_current_means",
    },
    resolver_view_hash: planResolver.resolver_view_hash,
  }],
});
baseWorld = executeBuilt(
  baseWorld,
  "phase73c_plan_formation",
  "goal_implementation_intention",
  planBuilt,
).world_state;
const sourcePlan = planBuilt.result.implementation_intention_events_created[0];

const constraintContent = {
  modality: "constraint_related",
  evidence_kind: "action_outcome",
  perceived_evidence: {
    result: "blocked",
    blocker: "wet_surface_slipped_under_hand",
  },
  source: "character_visible_world_evidence",
  world_truth_authority: false,
  subjective_interpretation_required: true,
  actual_means_feasibility_verdict_exposed: false,
};
const constraintMemory = makeMemory(
  "phase73c_constraint_memory",
  INTERPRET_TURN,
  constraintContent,
);
baseWorld.memories = {
  [CHARACTER]: [clone(constraintMemory)],
};
const sourceMemories = [sourceRecord(CHARACTER, constraintMemory)];
const phase73aProjection = [{
  character: CHARACTER,
  observation_content_hashes: [hashAgentRunValue(constraintContent)],
}];

function commitAssessment(world, assessment, proposition) {
  const resolverView = buildWorldSimulationSubjectiveMeansFeasibilityResolverView({
    world_state: world,
    turn_id: INTERPRET_TURN,
    source_memory_records: sourceMemories,
    phase73a_observation_projections: phase73aProjection,
  });
  const characterContext = resolverView.character_contexts.find(
    (entry) => entry.character === CHARACTER,
  );
  assert.ok(characterContext);
  const targetMeans = characterContext.represented_means.find(
    (entry) => entry.implementation_intention_id === sourcePlan.implementation_intention_id,
  );
  assert.ok(targetMeans);
  const interpretation = buildWorldSimulationSubjectiveMeansFeasibilityClaimProposals({
    resolver_view: resolverView,
    interpretation_decisions: [{
      character: CHARACTER,
      target_means_ref: targetMeans.means_ref,
      assessment,
      proposition,
      source_memory_refs: [constraintMemory.memory_id],
      grounding_refs: [],
    }],
  });
  const decision = interpretation.decisions[0];
  const claimBuild = buildWorldSimulationSubjectiveClaims({
    world_state: world,
    turn_id: INTERPRET_TURN,
    source_memory_records: sourceMemories,
    claim_proposals: interpretation.claim_proposals,
  });
  const claimExecution = executeBuilt(
    world,
    INTERPRET_TURN,
    "subjective_claim",
    claimBuild,
  );
  const claimWorld = claimExecution.world_state;
  const claimEvent = claimBuild.result.claim_events_created.find(
    (event) => event.derivation?.proposal_ref === decision.interpretation_ref,
  );
  assert.ok(claimEvent);

  const resolution = resolveWorldSimulationSubjectiveBeliefs({
    world_state: claimWorld,
    turn_id: INTERPRET_TURN,
  });
  const revisionBuild = buildWorldSimulationSubjectiveBeliefRevisions({
    world_state: claimWorld,
    turn_id: INTERPRET_TURN,
    resolution: resolution.result,
  });
  const revisionExecution = executeBuilt(
    claimWorld,
    INTERPRET_TURN,
    "subjective_belief_revision",
    revisionBuild,
  );
  const beliefWorld = revisionExecution.world_state;

  const linkageBuild = buildWorldSimulationSubjectiveMeansFeasibilityLinkages({
    world_state: beliefWorld,
    turn_id: INTERPRET_TURN,
    interpretation_decisions: [decision],
  });
  assert.equal(linkageBuild.result.linkage_events_created.length, 1);
  const linkageEvent = linkageBuild.result.linkage_events_created[0];
  assert.equal(linkageEvent.assessment, assessment);
  assert.equal(linkageEvent.claim_event_id, claimEvent.claim_event_id);
  assert.equal(linkageEvent.phase66_belief_authority_preserved, true);
  assert.equal(linkageEvent.objective_feasibility_verified, false);
  assert.equal(linkageEvent.same_turn_replanning_allowed, false);

  // Phase62K must reject a linkage write that omits its authoritative context.
  const noContextQueue = buildWorldSimulationChronologicalMutationQueue({
    turn_id: `${INTERPRET_TURN}:subjective_means_feasibility_linkage`,
    world_state_hash: hashAgentRunValue(beliefWorld),
    state_transitions: linkageBuild.result.state_transitions,
    elapsed_ms: 0,
  });
  assert.throws(
    () => executeWorldSimulationChronologicalMutationQueue({
      world_state: beliefWorld,
      preview_world_state: linkageBuild.result.preview_world_state,
      queue: noContextQueue,
    }),
    (error) => error?.code
      === "WORLD_SIMULATION_SUBJECTIVE_MEANS_LINKAGE_VALIDATION_CONTEXT_REQUIRED",
  );

  const linkageExecution = executeBuilt(
    beliefWorld,
    INTERPRET_TURN,
    "subjective_means_feasibility_linkage",
    linkageBuild,
    {
      subjective_means_feasibility_reconsideration:
        linkageBuild.result.authoritative_validation_context,
    },
  );
  return {
    world_state: linkageExecution.world_state,
    decision,
    claim_event: claimEvent,
    linkage_event: linkageEvent,
    linkage_build: linkageBuild,
  };
}

const contract = buildWorldSimulationSubjectiveMeansFeasibilityReconsiderationContract();
assert.equal(contract.phase, "Phase73C");
assert.equal(contract.version, worldSimulationSubjectiveMeansFeasibilityReconsiderationVersion);
assert.equal(contract.semantic_linkage_store_only, true);
assert.equal(contract.parallel_belief_store_created, false);
assert.equal(contract.phase66_active_belief_required_for_trigger, true);
assert.equal(contract.perceived_blocked_may_trigger_reconsideration, true);
assert.equal(contract.uncertain_auto_triggers_reconsideration, false);
assert.equal(contract.perceived_feasible_auto_triggers_reconsideration, false);
assert.equal(contract.conflicting_active_assessments_fail_closed, true);
assert.equal(contract.same_turn_feedback_allowed, false);
assert.equal(contract.direct_plan_mutation_allowed, false);
assert.equal(contract.direct_goal_mutation_allowed, false);
assert.equal(contract.phase71_owns_alternative_means_replanning, true);
assert.equal(contract.phase72_owns_objective_replacement_feasibility, true);

const queueContract = buildWorldSimulationChronologicalMutationQueueContract();
assert.equal(queueContract.execution.phase73c_subjective_means_linkage_event_write_once_enforced, true);
assert.equal(queueContract.execution.phase73c_subjective_means_linkage_event_content_address_verified, true);
assert.equal(queueContract.execution.phase73c_phase73b_interpretation_identity_recomputed, true);
assert.equal(queueContract.execution.phase73c_phase65_claim_hash_and_history_membership_revalidated, true);
assert.equal(queueContract.execution.phase73c_phase66_belief_authority_preserved, true);
assert.equal(queueContract.execution.phase73c_subjective_means_linkage_history_append_only_enforced, true);
assert.equal(queueContract.execution.phase73c_same_turn_replanning_rejected, true);
assert.equal(queueContract.execution.phase73c_authoritative_queue_validator_invoked, true);

const blocked = commitAssessment(
  clone(baseWorld),
  "perceived_blocked",
  "我認為現在這個攀爬方式做不到，必須換一個方法。",
);

const sameTurnTriggers = projectWorldSimulationSubjectiveMeansReconsiderationTriggers({
  world_state: blocked.world_state,
  current_turn_id: INTERPRET_TURN,
});
assert.equal(
  sameTurnTriggers.triggers.length,
  0,
  "A Phase73B/66 belief formed this turn must not feed back into same-turn Phase71.",
);

const laterTriggers = projectWorldSimulationSubjectiveMeansReconsiderationTriggers({
  world_state: blocked.world_state,
  current_turn_id: REPLAN_TURN,
});
assert.equal(laterTriggers.triggers.length, 1);
const blockedTrigger = laterTriggers.triggers[0];
assert.equal(blockedTrigger.trigger_kind, "committed_subjective_means_block");
assert.equal(blockedTrigger.character, CHARACTER);
assert.equal(blockedTrigger.goal_id, GOAL_ID);
assert.equal(
  blockedTrigger.source_implementation_intention_id,
  sourcePlan.implementation_intention_id,
);
assert.equal(blockedTrigger.assessment, "perceived_blocked");
assert.equal(blockedTrigger.prior_committed_only, true);
assert.equal(blockedTrigger.subjective_not_world_truth, true);
assert.equal(blockedTrigger.objective_feasibility_verified, false);

const uncertain = commitAssessment(
  clone(baseWorld),
  "uncertain",
  "我還不能確定這個攀爬方法是不是做不到。",
);
assert.equal(
  projectWorldSimulationSubjectiveMeansReconsiderationTriggers({
    world_state: uncertain.world_state,
    current_turn_id: REPLAN_TURN,
  }).triggers.length,
  0,
  "Uncertainty alone must not eagerly trigger replanning.",
);

const feasible = commitAssessment(
  clone(baseWorld),
  "perceived_feasible",
  "我認為調整抓點後這個攀爬方式仍然可行。",
);
assert.equal(
  projectWorldSimulationSubjectiveMeansReconsiderationTriggers({
    world_state: feasible.world_state,
    current_turn_id: REPLAN_TURN,
  }).triggers.length,
  0,
  "A perceived-feasible belief must not trigger means reconsideration.",
);

const blockedPlusUncertain = commitAssessment(
  clone(blocked.world_state),
  "uncertain",
  "雖然我先前認為這個方法不行，但現在仍有一些不確定。",
);
const ambiguousProjection = projectWorldSimulationSubjectiveMeansReconsiderationTriggers({
  world_state: blockedPlusUncertain.world_state,
  current_turn_id: REPLAN_TURN,
});
assert.equal(
  ambiguousProjection.triggers.length,
  0,
  "Conflicting active blocked and uncertain assessments must fail closed rather than eagerly replan.",
);
assert.equal(
  ambiguousProjection.audit.ambiguous_active_assessment_group_count,
  1,
);

// A prior committed blocked belief is sufficient for Phase71 eligibility even
// with zero Phase69D failure events.
const sourceView = buildWorldSimulationAdaptiveReplanningResolverView({
  world_state: blocked.world_state,
  turn_id: REPLAN_TURN,
  alternative_means_candidates: [],
});
assert.equal(sourceView.eligible_source_plans.length, 1);
const eligibleSource = sourceView.eligible_source_plans[0];
assert.equal(eligibleSource.eligibility_basis, "committed_subjective_means_block");
assert.equal(eligibleSource.consecutive_failure_count, 0);
assert.deepEqual(eligibleSource.failure_evidence_refs, []);
assert.equal(eligibleSource.subjective_reconsideration_trigger_refs.length, 1);
assert.equal(
  eligibleSource.subjective_reconsideration_trigger_refs[0].trigger_ref,
  blockedTrigger.trigger_ref,
);
assert.equal(sourceView.prior_committed_subjective_block_belief_may_also_trigger, true);
assert.equal(sourceView.same_turn_subjective_belief_feedback_allowed, false);

// If both eligibility bases are available, the established repeated-failure
// basis wins deterministically and must not carry the secondary subjective
// trigger provenance into a failure-basis event.
let dualBasisWorld = addFailureFeedback(
  clone(blocked.world_state),
  "phase73c_prior_failure_001",
);
dualBasisWorld = addFailureFeedback(
  dualBasisWorld,
  "phase73c_prior_failure_002",
);
const dualBasisSourceView = buildWorldSimulationAdaptiveReplanningResolverView({
  world_state: dualBasisWorld,
  turn_id: REPLAN_TURN,
  alternative_means_candidates: [],
});
assert.equal(dualBasisSourceView.eligible_source_plans.length, 1);
const dualBasisSource = dualBasisSourceView.eligible_source_plans[0];
assert.equal(dualBasisSource.eligibility_basis, "repeated_committed_failure");
assert.equal(dualBasisSource.consecutive_failure_count, 2);
assert.equal(dualBasisSource.failure_evidence_refs.length, 2);
assert.deepEqual(dualBasisSource.subjective_reconsideration_trigger_refs, []);
const dualBasisBeliefGrounding = dualBasisSourceView.means_grounding_catalog.find((grounding) =>
  grounding.source_plan_ref === dualBasisSource.source_plan_ref
  && grounding.grounding_kind === "active_subjective_belief"
  && grounding.source_event_id === blocked.claim_event.claim_event_id);
assert.ok(dualBasisBeliefGrounding);
const dualBasisCandidateView = buildWorldSimulationAdaptiveReplanningResolverView({
  world_state: dualBasisWorld,
  turn_id: REPLAN_TURN,
  alternative_means_candidates: [{
    source_plan_ref: dualBasisSource.source_plan_ref,
    candidate_kind: "replace_means",
    means_grounding_refs: [dualBasisBeliefGrounding.grounding_ref],
    replacement_cue_descriptor: {
      cue_kind: "obstacle",
      label: "wall_route_failed_and_subjectively_blocked",
      context: "deterministic_failure_basis_precedence",
    },
    replacement_response_descriptor: {
      response_kind: "seek_support",
      label: "ask_companion_after_repeated_failure",
      context: "bounded_character_owned_alternative",
    },
  }],
});
const dualBasisCandidate = dualBasisCandidateView.alternative_means_candidates[0];
const dualBasisBuilt = buildWorldSimulationAdaptiveReplanningEvents({
  world_state: dualBasisWorld,
  turn_id: REPLAN_TURN,
  resolver_view: dualBasisCandidateView,
  replanning_decisions: [{
    source_plan_ref: dualBasisSource.source_plan_ref,
    candidate_ref: dualBasisCandidate.candidate_ref,
  }],
});
const dualBasisEvent = dualBasisBuilt.result.adaptive_replanning_events_created[0];
assert.equal(dualBasisEvent.eligibility_basis, "repeated_committed_failure");
assert.equal(dualBasisEvent.repeated_prior_failure_required, true);
assert.equal(dualBasisEvent.committed_subjective_means_block_sufficient, false);
assert.equal(dualBasisEvent.failure_evidence_refs.length, 2);
assert.deepEqual(dualBasisEvent.subjective_reconsideration_trigger_refs, []);

const beliefGrounding = sourceView.means_grounding_catalog.find((grounding) =>
  grounding.source_plan_ref === eligibleSource.source_plan_ref
  && grounding.grounding_kind === "active_subjective_belief"
  && grounding.source_event_id === blocked.claim_event.claim_event_id);
assert.ok(beliefGrounding, "Phase71 should expose the active blocked belief as bounded same-character grounding.");

const candidateView = buildWorldSimulationAdaptiveReplanningResolverView({
  world_state: blocked.world_state,
  turn_id: REPLAN_TURN,
  alternative_means_candidates: [{
    source_plan_ref: eligibleSource.source_plan_ref,
    candidate_kind: "replace_means",
    means_grounding_refs: [beliefGrounding.grounding_ref],
    replacement_cue_descriptor: {
      cue_kind: "obstacle",
      label: "wall_route_subjectively_blocked",
      context: "later_turn_belief_grounded_reconsideration",
    },
    replacement_response_descriptor: {
      response_kind: "seek_support",
      label: "ask_companion_for_alternate_access",
      context: "character_owned_alternative_means",
    },
  }],
});
const candidate = candidateView.alternative_means_candidates[0];
assert.ok(candidate);
assert.deepEqual(candidate.means_grounding_kinds, ["active_subjective_belief"]);

const adaptiveBuilt = buildWorldSimulationAdaptiveReplanningEvents({
  world_state: blocked.world_state,
  turn_id: REPLAN_TURN,
  resolver_view: candidateView,
  replanning_decisions: [{
    source_plan_ref: eligibleSource.source_plan_ref,
    candidate_ref: candidate.candidate_ref,
  }],
});
assert.equal(adaptiveBuilt.result.replanning_decision_count, 1);
const replanningEvent = adaptiveBuilt.result.adaptive_replanning_events_created[0];
assert.equal(replanningEvent.eligibility_basis, "committed_subjective_means_block");
assert.equal(replanningEvent.consecutive_failure_count, 0);
assert.deepEqual(replanningEvent.failure_evidence_refs, []);
assert.equal(replanningEvent.subjective_reconsideration_trigger_refs.length, 1);
assert.equal(replanningEvent.repeated_prior_failure_required, false);
assert.equal(replanningEvent.committed_subjective_means_block_sufficient, true);
assert.equal(replanningEvent.prior_committed_subjective_belief_only, true);
assert.equal(replanningEvent.same_turn_subjective_belief_feedback_allowed, false);
assert.equal(replanningEvent.objective_feasibility_verified, false);

const phase69bQueue = buildWorldSimulationChronologicalMutationQueue({
  turn_id: `${REPLAN_TURN}:goal_implementation_intention_revision`,
  world_state_hash: hashAgentRunValue(blocked.world_state),
  state_transitions: adaptiveBuilt.result.phase69b_revision_state_transitions,
  elapsed_ms: 0,
});
const afterRevision = executeWorldSimulationChronologicalMutationQueue({
  world_state: blocked.world_state,
  preview_world_state: adaptiveBuilt.result.phase69b_preview_world_state,
  queue: phase69bQueue,
}).next_world_state;
const phase71Queue = buildWorldSimulationChronologicalMutationQueue({
  turn_id: `${REPLAN_TURN}:adaptive_replanning_alternative_means`,
  world_state_hash: hashAgentRunValue(afterRevision),
  state_transitions: adaptiveBuilt.result.state_transitions,
  validation_context: {
    adaptive_replanning_alternative_means:
      adaptiveBuilt.result.authoritative_validation_context,
  },
  elapsed_ms: 0,
});
const afterReplan = executeWorldSimulationChronologicalMutationQueue({
  world_state: afterRevision,
  preview_world_state: adaptiveBuilt.result.preview_world_state,
  queue: phase71Queue,
}).next_world_state;
const revised = projectWorldSimulationEffectiveRevisedGoalImplementationIntentions({
  world_state: afterReplan,
});
const revisedPlans = revised.plans_by_character[CHARACTER];
assert.equal(revisedPlans[sourcePlan.implementation_intention_id].state, "superseded");
assert.equal(
  revisedPlans[replanningEvent.replacement_implementation_intention_id].state,
  "active",
);
assert.equal(
  revisedPlans[replanningEvent.replacement_implementation_intention_id].goal_id,
  GOAL_ID,
);

// Tampering with the subjective trigger provenance is rejected even when the
// outer Phase71 context hash is recomputed.
const tamperedContext = clone(adaptiveBuilt.result.authoritative_validation_context);
tamperedContext.eligible_source_plans[0]
  .subjective_reconsideration_trigger_refs[0].trigger_hash = "forged_trigger_hash";
const tamperedBody = clone(tamperedContext);
delete tamperedBody.context_hash;
tamperedContext.context_hash = hashAgentRunValue(tamperedBody);
const tamperedQueue = buildWorldSimulationChronologicalMutationQueue({
  turn_id: `${REPLAN_TURN}:adaptive_replanning_alternative_means`,
  world_state_hash: hashAgentRunValue(afterRevision),
  state_transitions: adaptiveBuilt.result.state_transitions,
  validation_context: {
    adaptive_replanning_alternative_means: tamperedContext,
  },
  elapsed_ms: 0,
});
assert.throws(
  () => executeWorldSimulationChronologicalMutationQueue({
    world_state: afterRevision,
    preview_world_state: adaptiveBuilt.result.preview_world_state,
    queue: tamperedQueue,
  }),
  (error) => error?.code === "WORLD_SIMULATION_ADAPTIVE_REPLANNING_SOURCE_OUT_OF_CONTEXT",
);

const adaptiveContract = buildWorldSimulationAdaptiveReplanningContract();
assert.equal(adaptiveContract.prior_committed_subjective_block_belief_is_alternative_trigger, true);
assert.equal(adaptiveContract.subjective_reconsideration_trigger_owner, "Phase73C");
assert.equal(adaptiveContract.uncertain_subjective_assessment_auto_triggers, false);
assert.equal(adaptiveContract.perceived_feasible_subjective_assessment_auto_triggers, false);
assert.equal(adaptiveContract.same_turn_subjective_belief_feedback_allowed, false);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const loopSource = fs.readFileSync(
  path.resolve(__dirname, "../../server/src/world-simulation-loop-service.mjs"),
  "utf8",
);
const beliefRevisionIndex = loopSource.indexOf("const subjectiveBeliefRevisionMutationExecution =");
const linkageIndex = loopSource.indexOf("const subjectiveMeansFeasibilityLinkage =", beliefRevisionIndex);
const feedbackIndex = loopSource.indexOf(
  "const implementationIntentionExecutionFeedbackDecisionResolution =",
  linkageIndex,
);
const adaptiveIndex = loopSource.indexOf("const adaptiveReplanningDecisionResolution =", feedbackIndex);
assert.ok(
  beliefRevisionIndex >= 0
    && linkageIndex > beliefRevisionIndex
    && feedbackIndex > linkageIndex
    && adaptiveIndex > feedbackIndex,
  "Phase73C linkage must persist after Phase66 belief revision and before later plan-lifecycle stages.",
);
assert.match(
  loopSource.slice(linkageIndex, feedbackIndex),
  /subjectiveMeansFeasibilityLinkageMutationExecution/,
);
assert.match(
  loopSource.slice(adaptiveIndex, adaptiveIndex + 900),
  /resolveAdaptiveReplanningDecisions\(\s*snapshot\.state/,
  "Phase71 must remain pinned to prior committed state so same-turn Phase73C cannot feed back.",
);
assert.match(
  loopSource,
  /subjective_means_feasibility_reconsideration:\s*buildWorldSimulationSubjectiveMeansFeasibilityReconsiderationContract\(\)/,
);
assert.match(
  loopSource,
  /next_world_state:\s*visibleConstraintObservationMutationExecution\.next_world_state/,
  "Atomic commit should still use the final authoritative Phase73A state, which transitively contains Phase73C linkage state.",
);

console.log("Phase73C belief-grounded means reconsideration tests passed.");
