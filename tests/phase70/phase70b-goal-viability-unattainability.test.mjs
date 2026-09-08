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
  buildWorldSimulationGoalAchievementEvents,
  buildWorldSimulationGoalAchievementResolverView,
} from "../../server/src/world-simulation-goal-achievement-verification-service.mjs";
import {
  buildWorldSimulationGoalUnattainabilityEvents,
  buildWorldSimulationGoalViabilityResolverView,
  buildWorldSimulationGoalViabilityUnattainabilityContract,
  projectWorldSimulationEffectiveMotivationalGoalViability,
  worldSimulationGoalViabilityUnattainabilityVersion,
} from "../../server/src/world-simulation-goal-viability-unattainability-service.mjs";

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
    target_descriptor: { label: "submit_application_before_deadline", context: "phase70b_acceptance" },
    motivation_basis_refs: [{
      source_kind: "phase68b_structured_self_model_aspect_event",
      source_event_id: "phase70b_source_aspect",
      source_event_hash: "phase70b_source_hash",
    }],
    motivation_relations: ["self_concordant_with"],
    resolver_view_hash: `phase70b_goal_resolver_${turnId}`,
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
function committedGoalWorld({ character = "伊萊亞斯・諾爾", goalId = "phase70b_goal_001", goalKind = "achieve_state" } = {}) {
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
function viabilityResolver(world, turnId, evidence = {}) {
  return buildWorldSimulationGoalViabilityResolverView({
    world_state: world,
    turn_id: turnId,
    state_transitions: evidence.state_transitions ?? [],
    action_outcomes: evidence.action_outcomes ?? [],
    knowledge_transitions: evidence.knowledge_transitions ?? [],
  });
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
      goal_viability_unattainability: built.result.authoritative_validation_context,
    };
  }
  const queue = buildWorldSimulationChronologicalMutationQueue(queueInput);
  return executeWorldSimulationChronologicalMutationQueue({
    world_state: world,
    preview_world_state: built.result.preview_world_state,
    queue,
  }).next_world_state;
}

const contract = buildWorldSimulationGoalViabilityUnattainabilityContract();
assert.equal(contract.phase, "Phase70B");
assert.deepEqual(contract.supported_operations, ["verify_unattainable"]);
assert.deepEqual(contract.eligible_goal_kinds, ["achieve_state", "restore_state"]);
assert.deepEqual(contract.eligible_goal_states, ["committed", "suspended"]);
assert.equal(contract.explicit_unattainability_verification_required, true);
assert.equal(contract.structural_authoritative_evidence_required, true);
assert.equal(contract.action_outcome_only_sufficient, false);
assert.equal(contract.action_failure_alone_sufficient, false);
assert.equal(contract.plan_failure_alone_sufficient, false);
assert.equal(contract.lack_of_progress_alone_sufficient, false);
assert.equal(contract.unattainability_is_abandonment, false);
assert.equal(contract.automatic_goal_abandonment, false);
assert.equal(contract.automatic_disengagement, false);
assert.equal(contract.automatic_reengagement, false);
assert.equal(contract.autonomous_replanning, false);
assert.equal(contract.authoritative_mutation_owner, "phase62k-authoritative-mutation-executor-v1");

const queueContract = buildWorldSimulationChronologicalMutationQueueContract();
assert.equal(queueContract.execution.phase70b_goal_unattainability_event_write_once_enforced, true);
assert.equal(queueContract.execution.phase70b_authoritative_queue_validator_invoked, true);
assert.equal(queueContract.execution.phase70b_structural_authoritative_evidence_required, true);
assert.equal(queueContract.execution.phase70b_action_outcome_only_is_insufficient, true);
assert.equal(queueContract.execution.phase70b_achievement_unattainability_mutual_exclusion_enforced, true);
assert.equal(queueContract.execution.phase70b_unattainability_does_not_imply_abandonment, true);

const base = committedGoalWorld();
let world = base.world;

// A failed action is evidence about an attempt, not a proof that the goal itself is impossible.
const failureTurn = "phase70b_action_failure_only";
const actionFailureView = viabilityResolver(world, failureTurn, {
  action_outcomes: [{ actor: base.character, action_id: "submit_once", result: "failed" }],
});
assert.equal(actionFailureView.version, worldSimulationGoalViabilityUnattainabilityVersion);
assert.equal(actionFailureView.eligible_goals.length, 1);
assert.equal(actionFailureView.authoritative_evidence.length, 1);
assert.equal(actionFailureView.authoritative_evidence[0].evidence_kind, "action_outcome");
const noVerdict = buildWorldSimulationGoalUnattainabilityEvents({
  world_state: world,
  turn_id: failureTurn,
  resolver_view: actionFailureView,
  unattainability_decisions: [],
});
assert.equal(noVerdict.result.unattainability_events_created.length, 0);
assert.equal(
  noVerdict.result.effective_goal_viability_projection.goals_by_character[base.character][base.goalId].unattainable,
  false,
  "Action failure must not auto-promote to goal unattainability.",
);
assert.throws(
  () => buildWorldSimulationGoalUnattainabilityEvents({
    world_state: world,
    turn_id: failureTurn,
    resolver_view: actionFailureView,
    unattainability_decisions: [{
      goal_ref: actionFailureView.eligible_goals[0].goal_ref,
      operation: "verify_unattainable",
      unattainability_basis_kind: "proven_goal_condition_unsatisfiable",
      evidence_refs: [actionFailureView.authoritative_evidence[0].evidence_ref],
    }],
  }),
  (error) => error?.code === "WORLD_SIMULATION_GOAL_UNATTAINABILITY_STRUCTURAL_EVIDENCE_REQUIRED",
  "Action outcome alone must be insufficient for an unattainability certificate.",
);

// Lack of progress is likewise not an unattainability verdict without an explicit decision.
const lackProgressTurn = "phase70b_lack_progress";
const lackProgressView = viabilityResolver(world, lackProgressTurn, {
  knowledge_transitions: [{ subject: base.character, field: "progress_note", from: "some", to: "none_recent" }],
});
const lackProgressNoDecision = buildWorldSimulationGoalUnattainabilityEvents({
  world_state: world,
  turn_id: lackProgressTurn,
  resolver_view: lackProgressView,
  unattainability_decisions: [],
});
assert.equal(lackProgressNoDecision.result.unattainability_events_created.length, 0);

// Explicit structural evidence can support a typed, auditable unattainability certificate.
const impossibleTurn = "phase70b_deadline_expired";
const impossibleView = viabilityResolver(world, impossibleTurn, {
  state_transitions: [{
    entity: "application_window",
    field: "status",
    from: "open",
    to: "closed_irreversibly",
    cause: "authoritative deadline expiry",
  }],
  action_outcomes: [{ actor: base.character, action_id: "submit_late", result: "rejected" }],
  knowledge_transitions: [{
    subject: base.character,
    field: "application_window_fact",
    from: "open",
    to: "irreversibly_closed",
  }],
});
const structuralRefs = impossibleView.authoritative_evidence
  .filter((entry) => entry.evidence_kind !== "action_outcome")
  .map((entry) => entry.evidence_ref)
  .reverse();
const explicitDecision = {
  goal_ref: impossibleView.eligible_goals[0].goal_ref,
  operation: "verify_unattainable",
  unattainability_basis_kind: "irreversible_deadline_expiry",
  evidence_refs: structuralRefs,
};
const builtA = buildWorldSimulationGoalUnattainabilityEvents({
  world_state: world,
  turn_id: impossibleTurn,
  resolver_view: impossibleView,
  unattainability_decisions: [explicitDecision],
});
const builtB = buildWorldSimulationGoalUnattainabilityEvents({
  world_state: clone(world),
  turn_id: impossibleTurn,
  resolver_view: clone(impossibleView),
  unattainability_decisions: [{ ...explicitDecision, evidence_refs: [...structuralRefs].reverse() }],
});
assert.equal(
  builtA.result.unattainability_events_created[0].goal_unattainability_event_hash,
  builtB.result.unattainability_events_created[0].goal_unattainability_event_hash,
  "Equivalent evidence sets must produce deterministic event identity regardless of resolver order.",
);
world = executeBuilt(world, impossibleTurn, "goal_viability_unattainability", builtA);

const viability = projectWorldSimulationEffectiveMotivationalGoalViability({ world_state: world });
const goal = viability.goals_by_character[base.character][base.goalId];
assert.equal(goal.unattainable, true);
assert.equal(goal.unattainability_basis_kind, "irreversible_deadline_expiry");
assert.equal(goal.state, "committed", "Phase70B must not mutate the Phase68D goal state into abandonment.");
assert.equal(goal.achieved, false);
assert.equal(world.motivational_goal_events[base.committed.goal_event_id].operation, "commit");
assert.equal(world.motivational_goal_history.length, 2, "Phase70B must preserve Phase68D history unchanged.");
assert.equal(viability.automatic_disengagement, false);
assert.equal(viability.automatic_reengagement, false);
assert.equal(viability.automatic_replanning, false);

// Achievement and unattainability are mutually exclusive terminal evidence semantics.
const achievementAfterUnattainable = buildWorldSimulationGoalAchievementResolverView({
  world_state: world,
  turn_id: "phase70b_achievement_after_unattainable",
  state_transitions: [{ entity: "application", field: "status", from: "pending", to: "submitted" }],
});
assert.equal(
  achievementAfterUnattainable.eligible_goals.length,
  0,
  "A goal already certified unattainable cannot later be offered to Phase70A achievement verification.",
);

// Duplicate unattainability is terminally forbidden by resolver eligibility.
const duplicateView = viabilityResolver(world, "phase70b_duplicate", {
  state_transitions: [{ entity: "application_window", field: "status", from: "closed", to: "closed" }],
});
assert.equal(duplicateView.eligible_goals.length, 0);

// maintain_state and avoid_state are horizon-sensitive and excluded from Phase70B v1 terminal unattainability semantics.
for (const goalKind of ["maintain_state", "avoid_state"]) {
  const horizon = committedGoalWorld({ goalId: `phase70b_${goalKind}`, goalKind });
  const view = viabilityResolver(horizon.world, `phase70b_${goalKind}_turn`, {
    state_transitions: [{ entity: "world", field: "status", from: "a", to: "b" }],
  });
  assert.equal(view.eligible_goals.length, 0);
}

// Phase62K must independently reject unattainability writes that lack the bounded current-turn evidence catalog.
const tamperBase = committedGoalWorld({ goalId: "phase70b_tamper_goal" });
const tamperTurn = "phase70b_tamper_turn";
const tamperView = viabilityResolver(tamperBase.world, tamperTurn, {
  state_transitions: [{ entity: "required_resource", field: "available", from: true, to: false, irreversible: true }],
});
const tamperBuilt = buildWorldSimulationGoalUnattainabilityEvents({
  world_state: tamperBase.world,
  turn_id: tamperTurn,
  resolver_view: tamperView,
  unattainability_decisions: [{
    goal_ref: tamperView.eligible_goals[0].goal_ref,
    unattainability_basis_kind: "irreversible_required_resource_loss",
    evidence_refs: [tamperView.authoritative_evidence[0].evidence_ref],
  }],
});
const missingContextQueue = buildWorldSimulationChronologicalMutationQueue({
  turn_id: `${tamperTurn}:goal_viability_unattainability`,
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
  (error) => error?.code === "WORLD_SIMULATION_GOAL_UNATTAINABILITY_VALIDATION_CONTEXT_REQUIRED",
);

const tamperedContext = clone(tamperBuilt.result.authoritative_validation_context);
tamperedContext.authoritative_evidence[0].evidence = { forged: true };
const tamperedContextQueue = buildWorldSimulationChronologicalMutationQueue({
  turn_id: `${tamperTurn}:goal_viability_unattainability`,
  world_state_hash: hashAgentRunValue(tamperBase.world),
  state_transitions: tamperBuilt.result.state_transitions,
  validation_context: { goal_viability_unattainability: tamperedContext },
  elapsed_ms: 0,
});
assert.throws(
  () => executeWorldSimulationChronologicalMutationQueue({
    world_state: tamperBase.world,
    preview_world_state: tamperBuilt.result.preview_world_state,
    queue: tamperedContextQueue,
  }),
  (error) => error?.code === "WORLD_SIMULATION_GOAL_UNATTAINABILITY_VALIDATION_CONTEXT_INVALID",
  "Phase62K must independently verify the bounded Phase70B authoritative evidence catalog.",
);

// Older Phase68D lifecycle writes may not reinterpret a terminal unattainability certificate as abandonment.
const illegalAbandon = makeGoalEvent({
  character: base.character,
  goalId: base.goalId,
  turnId: "phase70b_illegal_abandon",
  operation: "abandon",
  previous: base.committed,
});
const illegalQueue = buildWorldSimulationChronologicalMutationQueue({
  turn_id: "phase70b_illegal_abandon:motivation_goal_integration",
  world_state_hash: hashAgentRunValue(world),
  state_transitions: [{
    entity: "world",
    field: `motivational_goal_events.${illegalAbandon.goal_event_id}`,
    from: null,
    to: illegalAbandon,
    cause: "illegal legacy reinterpretation",
    source_layer: "motivation_goal_integration",
  }],
  elapsed_ms: 0,
});
assert.throws(
  () => executeWorldSimulationChronologicalMutationQueue({
    world_state: world,
    preview_world_state: {
      ...clone(world),
      motivational_goal_events: {
        ...clone(world.motivational_goal_events),
        [illegalAbandon.goal_event_id]: illegalAbandon,
      },
    },
    queue: illegalQueue,
  }),
  (error) => error?.code === "WORLD_SIMULATION_MOTIVATIONAL_GOAL_UNATTAINABLE_TERMINAL",
);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const loopSource = fs.readFileSync(
  path.resolve(__dirname, "../../server/src/world-simulation-loop-service.mjs"),
  "utf8",
);
const causalIndex = loopSource.indexOf("const causalResolution = assertCausalResolution");
const feedbackIndex = loopSource.indexOf("resolveImplementationIntentionExecutionFeedbackDecisions", causalIndex);
const achievementIndex = loopSource.indexOf("resolveGoalAchievementDecisions", feedbackIndex);
const viabilityIndex = loopSource.indexOf("resolveGoalViabilityDecisions", achievementIndex);
const adjustmentIndex = loopSource.indexOf("resolveGoalAdjustmentDecisions", viabilityIndex);
const commitIndex = loopSource.indexOf("commitWorldSimulationTurn", adjustmentIndex);
const postCommitIndex = loopSource.indexOf("let committedCurrentMindDelivery", commitIndex);
assert.ok(
  causalIndex >= 0
    && feedbackIndex > causalIndex
    && achievementIndex > feedbackIndex
    && viabilityIndex > achievementIndex
    && adjustmentIndex > viabilityIndex
    && commitIndex > adjustmentIndex
    && postCommitIndex > commitIndex,
  "Phase70B must run after causal adjudication, Phase69D, and Phase70A, and before downstream Phase70C/atomic commit.",
);
assert.match(loopSource.slice(viabilityIndex, adjustmentIndex), /snapshot\.state/);
assert.match(loopSource.slice(adjustmentIndex, commitIndex), /goalUnattainabilityMutationExecution\.next_world_state/);
assert.doesNotMatch(
  loopSource.slice(viabilityIndex, commitIndex),
  /result\s*===\s*["']failed["']|includes\(["']failed["']\)|result\s*===\s*["']failure["']/i,
  "World loop must not infer goal unattainability directly from action failure labels.",
);

const replayA = projectWorldSimulationEffectiveMotivationalGoalViability({ world_state: world });
const replayB = projectWorldSimulationEffectiveMotivationalGoalViability({ world_state: clone(world) });
assert.equal(replayA.projection_hash, replayB.projection_hash);

console.log("Phase70B goal viability / unattainability tests passed.");
