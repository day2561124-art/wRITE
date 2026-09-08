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
  buildWorldSimulationGoalUnattainabilityEvents,
  buildWorldSimulationGoalViabilityResolverView,
} from "../../server/src/world-simulation-goal-viability-unattainability-service.mjs";
import {
  buildWorldSimulationGoalAdjustmentEvents,
  buildWorldSimulationGoalAdjustmentResolverView,
  buildWorldSimulationGoalDisengagementReengagementContract,
  projectWorldSimulationEffectiveMotivationalGoalAdjustment,
  worldSimulationGoalDisengagementReengagementVersion,
} from "../../server/src/world-simulation-goal-disengagement-reengagement-service.mjs";

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
function makeGoalEvent({ character, goalId, turnId, operation, previous = null, label }) {
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
    target_descriptor: { label, context: "phase70c_acceptance" },
    motivation_basis_refs: [{
      source_kind: "phase68b_structured_self_model_aspect_event",
      source_event_id: "phase70c_source_aspect",
      source_event_hash: "phase70c_source_hash",
    }],
    motivation_relations: ["self_concordant_with"],
    resolver_view_hash: `phase70c_goal_resolver_${turnId}`,
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
function twoCommittedGoalsWorld() {
  const character = "伊萊亞斯・諾爾";
  const sourceGoalId = "phase70c_unattainable_goal";
  const targetGoalId = "phase70c_alternative_goal";
  const sourceProposed = makeGoalEvent({
    character, goalId: sourceGoalId, turnId: "70c_source_propose", operation: "propose", label: "enter_closed_competition",
  });
  const sourceCommitted = makeGoalEvent({
    character, goalId: sourceGoalId, turnId: "70c_source_commit", operation: "commit", previous: sourceProposed, label: "enter_closed_competition",
  });
  const targetProposed = makeGoalEvent({
    character, goalId: targetGoalId, turnId: "70c_target_propose", operation: "propose", previous: sourceCommitted, label: "train_for_next_selection",
  });
  const targetCommitted = makeGoalEvent({
    character, goalId: targetGoalId, turnId: "70c_target_commit", operation: "commit", previous: targetProposed, label: "train_for_next_selection",
  });
  const events = [sourceProposed, sourceCommitted, targetProposed, targetCommitted];
  return {
    character,
    sourceGoalId,
    targetGoalId,
    sourceCommitted,
    targetCommitted,
    world: {
      motivational_goal_events: Object.fromEntries(events.map((event) => [event.goal_event_id, event])),
      motivational_goal_history: events.map(goalRef),
    },
  };
}
function executePhase70BBuilt(world, turnId, built) {
  const queue = buildWorldSimulationChronologicalMutationQueue({
    turn_id: `${turnId}:goal_viability_unattainability`,
    world_state_hash: hashAgentRunValue(world),
    state_transitions: built.result.state_transitions,
    validation_context: {
      goal_viability_unattainability: built.result.authoritative_validation_context,
    },
    elapsed_ms: 0,
  });
  return executeWorldSimulationChronologicalMutationQueue({
    world_state: world,
    preview_world_state: built.result.preview_world_state,
    queue,
  }).next_world_state;
}
function executePhase70CBuilt(world, turnId, built, validationContext = built.result.authoritative_validation_context) {
  const queueInput = {
    turn_id: `${turnId}:goal_disengagement_reengagement`,
    world_state_hash: hashAgentRunValue(world),
    state_transitions: built.result.state_transitions,
    elapsed_ms: 0,
  };
  if (validationContext) {
    queueInput.validation_context = {
      goal_disengagement_reengagement: validationContext,
    };
  }
  const queue = buildWorldSimulationChronologicalMutationQueue(queueInput);
  return executeWorldSimulationChronologicalMutationQueue({
    world_state: world,
    preview_world_state: built.result.preview_world_state,
    queue,
  }).next_world_state;
}
function certifySourceUnattainable(base) {
  const turnId = "phase70c_prior_unattainability";
  const view = buildWorldSimulationGoalViabilityResolverView({
    world_state: base.world,
    turn_id: turnId,
    state_transitions: [{
      entity: "competition_entry",
      field: "window",
      from: "open",
      to: "irreversibly_closed",
      cause: "deadline expired",
    }],
  });
  const source = view.eligible_goals.find((goal) => goal.goal_id === base.sourceGoalId);
  const structuralEvidence = view.authoritative_evidence.find(
    (entry) => entry.evidence_kind === "causal_state_transition",
  );
  const built = buildWorldSimulationGoalUnattainabilityEvents({
    world_state: base.world,
    turn_id: turnId,
    resolver_view: view,
    unattainability_decisions: [{
      goal_ref: source.goal_ref,
      operation: "verify_unattainable",
      unattainability_basis_kind: "irreversible_deadline_expiry",
      evidence_refs: [structuralEvidence.evidence_ref],
    }],
  });
  return executePhase70BBuilt(base.world, turnId, built);
}

const contract = buildWorldSimulationGoalDisengagementReengagementContract();
assert.equal(contract.phase, "Phase70C");
assert.equal(contract.version, worldSimulationGoalDisengagementReengagementVersion);
assert.deepEqual(contract.supported_operations, ["disengage_unattainable", "reengage_alternative"]);
assert.equal(contract.unattainability_is_not_disengagement, true);
assert.equal(contract.disengagement_requires_phase70b_unattainability, true);
assert.equal(contract.reengagement_requires_prior_committed_disengagement, true);
assert.equal(contract.reengagement_requires_distinct_existing_committed_goal, true);
assert.equal(contract.same_turn_disengage_reengage_allowed, false);
assert.equal(contract.same_goal_reengagement_allowed, false);
assert.equal(contract.phase68d_goal_state_rewritten, false);
assert.equal(contract.phase68d_abandon_event_auto_created, false);
assert.equal(contract.new_goal_creation_modeled, false);
assert.equal(contract.goal_commitment_creation_modeled, false);
assert.equal(contract.replanning_modeled, false);

const queueContract = buildWorldSimulationChronologicalMutationQueueContract();
assert.equal(queueContract.execution.phase70c_goal_adjustment_event_write_once_enforced, true);
assert.equal(queueContract.execution.phase70c_resolver_candidate_membership_verified, true);
assert.equal(queueContract.execution.phase70c_unattainability_does_not_imply_disengagement, true);
assert.equal(queueContract.execution.phase70c_reengagement_requires_prior_committed_disengagement, true);
assert.equal(queueContract.execution.phase70c_same_goal_reengagement_rejected, true);
assert.equal(queueContract.execution.phase70c_replanning_rejected, true);
assert.equal(queueContract.execution.phase70c_authoritative_queue_validator_invoked, true);

const base = twoCommittedGoalsWorld();
let world = certifySourceUnattainable(base);
const phase68dHistoryBefore = clone(world.motivational_goal_history);

// Phase70B unattainability is eligibility evidence, not an automatic disengagement side effect.
const disengageTurn = "phase70c_explicit_disengage";
const disengageView = buildWorldSimulationGoalAdjustmentResolverView({
  world_state: world,
  turn_id: disengageTurn,
});
assert.equal(disengageView.disengage_candidates.length, 1);
assert.equal(disengageView.disengage_candidates[0].source_goal_id, base.sourceGoalId);
assert.equal(
  disengageView.alternative_goals.some((goal) => goal.target_goal_id === base.targetGoalId),
  true,
);
assert.equal(
  disengageView.alternative_goals.some((goal) => goal.target_goal_id === base.sourceGoalId),
  false,
  "An unattainable source goal must never be offered as its own reengagement target.",
);
const noAutomaticAdjustment = buildWorldSimulationGoalAdjustmentEvents({
  world_state: world,
  turn_id: disengageTurn,
  resolver_view: disengageView,
  adjustment_decisions: [],
});
assert.equal(noAutomaticAdjustment.result.adjustment_events_created.length, 0);
assert.equal(
  noAutomaticAdjustment.result.effective_goal_adjustment_projection
    .goals_by_character[base.character][base.sourceGoalId].goal_adjustment_state,
  "unadjusted",
);

const disengageDecision = {
  operation: "disengage_unattainable",
  source_goal_ref: disengageView.disengage_candidates[0].source_goal_ref,
  reason: "accept_explicitly_verified_impossibility",
};
const disengageBuiltA = buildWorldSimulationGoalAdjustmentEvents({
  world_state: world,
  turn_id: disengageTurn,
  resolver_view: disengageView,
  adjustment_decisions: [disengageDecision],
});
const disengageBuiltB = buildWorldSimulationGoalAdjustmentEvents({
  world_state: clone(world),
  turn_id: disengageTurn,
  resolver_view: clone(disengageView),
  adjustment_decisions: [clone(disengageDecision)],
});
assert.equal(
  disengageBuiltA.result.adjustment_events_created[0].goal_adjustment_event_hash,
  disengageBuiltB.result.adjustment_events_created[0].goal_adjustment_event_hash,
  "Equivalent explicit disengagement decisions must be deterministic.",
);

// Phase62K rejects an otherwise valid preview if the authoritative resolver membership context is absent.
assert.throws(
  () => executePhase70CBuilt(world, disengageTurn, disengageBuiltA, null),
  (error) => error?.code === "WORLD_SIMULATION_GOAL_ADJUSTMENT_VALIDATION_CONTEXT_REQUIRED",
);
const tamperedContext = clone(disengageBuiltA.result.authoritative_validation_context);
tamperedContext.disengage_candidates[0].source_goal_event_hash = "forged";
assert.throws(
  () => executePhase70CBuilt(world, disengageTurn, disengageBuiltA, tamperedContext),
  (error) => error?.code === "WORLD_SIMULATION_GOAL_ADJUSTMENT_VALIDATION_CONTEXT_INVALID",
  "Phase62K must independently reject tampered Phase70C resolver catalogs.",
);

world = executePhase70CBuilt(world, disengageTurn, disengageBuiltA);
let adjustment = projectWorldSimulationEffectiveMotivationalGoalAdjustment({ world_state: world });
let source = adjustment.goals_by_character[base.character][base.sourceGoalId];
let target = adjustment.goals_by_character[base.character][base.targetGoalId];
assert.equal(source.unattainable, true);
assert.equal(source.state, "committed");
assert.equal(source.disengaged, true);
assert.equal(source.goal_adjustment_state, "disengaged");
assert.equal(target.state, "committed");
assert.equal(target.goal_adjustment_state, "unadjusted");
assert.deepEqual(world.motivational_goal_history, phase68dHistoryBefore, "Phase70C must never rewrite Phase68D goal history.");
assert.equal(
  Object.values(world.motivational_goal_events).some((event) => event.operation === "abandon"),
  false,
  "Phase70C disengagement must not synthesize a Phase68D abandon event.",
);

// Same-turn synthetic disengage -> reengage chaining is deliberately rejected.
const sameTurnPreviewView = buildWorldSimulationGoalAdjustmentResolverView({
  world_state: disengageBuiltA.result.preview_world_state,
  turn_id: disengageTurn,
});
assert.equal(sameTurnPreviewView.reengage_sources.length, 1);
assert.throws(
  () => buildWorldSimulationGoalAdjustmentEvents({
    world_state: disengageBuiltA.result.preview_world_state,
    turn_id: disengageTurn,
    resolver_view: sameTurnPreviewView,
    adjustment_decisions: [{
      operation: "reengage_alternative",
      source_goal_ref: sameTurnPreviewView.reengage_sources[0].source_goal_ref,
      alternative_goal_ref: sameTurnPreviewView.alternative_goals.find(
        (goal) => goal.target_goal_id === base.targetGoalId,
      ).alternative_goal_ref,
    }],
  }),
  (error) => error?.code === "WORLD_SIMULATION_GOAL_REENGAGEMENT_SOURCE_INVALID",
);

// A later turn may explicitly redirect commitment to another already-existing viable committed goal.
const reengageTurn = "phase70c_later_reengage";
const reengageView = buildWorldSimulationGoalAdjustmentResolverView({
  world_state: world,
  turn_id: reengageTurn,
});
assert.equal(reengageView.disengage_candidates.length, 0);
assert.equal(reengageView.reengage_sources.length, 1);
const reengageSource = reengageView.reengage_sources[0];
const alternative = reengageView.alternative_goals.find(
  (goal) => goal.target_goal_id === base.targetGoalId,
);
assert.ok(alternative);
assert.throws(
  () => buildWorldSimulationGoalAdjustmentEvents({
    world_state: world,
    turn_id: reengageTurn,
    resolver_view: reengageView,
    adjustment_decisions: [{
      operation: "reengage_alternative",
      source_goal_ref: reengageSource.source_goal_ref,
      alternative_goal_ref: "phase70c_alternative_not_in_view",
    }],
  }),
  (error) => error?.code === "WORLD_SIMULATION_GOAL_REENGAGEMENT_TARGET_INVALID",
);
const reengageBuilt = buildWorldSimulationGoalAdjustmentEvents({
  world_state: world,
  turn_id: reengageTurn,
  resolver_view: reengageView,
  adjustment_decisions: [{
    operation: "reengage_alternative",
    source_goal_ref: reengageSource.source_goal_ref,
    alternative_goal_ref: alternative.alternative_goal_ref,
    reason: "redirect_commitment_to_existing_meaningful_goal",
  }],
});
world = executePhase70CBuilt(world, reengageTurn, reengageBuilt);
adjustment = projectWorldSimulationEffectiveMotivationalGoalAdjustment({ world_state: world });
source = adjustment.goals_by_character[base.character][base.sourceGoalId];
target = adjustment.goals_by_character[base.character][base.targetGoalId];
assert.equal(source.unattainable, true);
assert.equal(source.disengaged, true);
assert.equal(source.goal_adjustment_state, "disengaged");
assert.equal(target.state, "committed");
assert.equal(target.unattainable, false);
assert.equal(target.goal_adjustment_state, "reengaged_alternative");
assert.deepEqual(target.reengaged_from_goal_ids, [base.sourceGoalId]);
assert.deepEqual(world.motivational_goal_history, phase68dHistoryBefore);
assert.equal(world.goal_implementation_intention_events, undefined, "Phase70C must not create a Phase69 plan.");
assert.equal(world.goal_implementation_intention_revision_events, undefined);

// One source disengagement gets at most one explicit alternative reengagement in v1.
const duplicateReengageView = buildWorldSimulationGoalAdjustmentResolverView({
  world_state: world,
  turn_id: "phase70c_duplicate_reengage",
});
assert.equal(duplicateReengageView.reengage_sources.length, 0);

// Replay is deterministic and preserves the source goal's terminal unattainability.
const replayA = projectWorldSimulationEffectiveMotivationalGoalAdjustment({ world_state: world });
const replayB = projectWorldSimulationEffectiveMotivationalGoalAdjustment({ world_state: clone(world) });
assert.equal(replayA.projection_hash, replayB.projection_hash);
assert.equal(
  replayA.goals_by_character[base.character][base.sourceGoalId].unattainable,
  true,
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
const commitIndex = loopSource.indexOf("commitWorldSimulationTurn", adjustmentIndex);
const postCommitIndex = loopSource.indexOf("let committedCurrentMindDelivery", commitIndex);
assert.ok(
  feedbackIndex >= 0
    && achievementIndex > feedbackIndex
    && viabilityIndex > achievementIndex
    && adjustmentIndex > viabilityIndex
    && commitIndex > adjustmentIndex
    && postCommitIndex > commitIndex,
  "Phase70C must run after Phase69D/70A/70B and before atomic world commit.",
);
assert.match(loopSource.slice(adjustmentIndex, commitIndex), /snapshot\.state/);
assert.match(loopSource.slice(commitIndex, postCommitIndex), /goalAdjustmentMutationExecution\.next_world_state/);
assert.doesNotMatch(
  loopSource.slice(adjustmentIndex, commitIndex),
  /result\s*===\s*["']failed["']|includes\(["']failed["']\)|result\s*===\s*["']failure["']/i,
  "World loop must not infer Phase70C disengagement from action failure labels.",
);
assert.doesNotMatch(
  loopSource.slice(adjustmentIndex, commitIndex),
  /goalReplanningResolver|alternativeMeansResolver|buildWorldSimulationGoalImplementationIntention|resolveImplementationIntentionRevision/i,
  "Phase70C must not perform Phase71 replanning or alternative-means search.",
);

console.log("Phase70C goal disengagement / reengagement tests passed.");
