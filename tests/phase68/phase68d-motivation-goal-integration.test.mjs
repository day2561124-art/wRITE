import assert from "node:assert/strict";

import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import { buildWorldSimulationSubjectiveClaims } from "../../server/src/world-simulation-subjective-claim-projection-service.mjs";
import { resolveWorldSimulationSubjectiveBeliefs } from "../../server/src/world-simulation-subjective-belief-resolution-service.mjs";
import { buildWorldSimulationSubjectiveBeliefRevisions } from "../../server/src/world-simulation-subjective-belief-revision-service.mjs";
import {
  buildWorldSimulationChronologicalMutationQueue,
  buildWorldSimulationChronologicalMutationQueueContract,
  executeWorldSimulationChronologicalMutationQueue,
} from "../../server/src/world-simulation-chronological-mutation-queue-service.mjs";
import {
  autobiographicalSelfInterpretationEventSchemaVersion,
  autobiographicalSelfInterpretationHistoryReferenceSchemaVersion,
  worldSimulationAutobiographicalSelfInterpretationVersion,
} from "../../server/src/world-simulation-autobiographical-self-interpretation-service.mjs";
import {
  buildWorldSimulationStructuredSelfModelAspects,
  buildWorldSimulationStructuredSelfModelResolverView,
} from "../../server/src/world-simulation-structured-self-model-service.mjs";
import {
  buildWorldSimulationMotivationGoalIntegrationContract,
  buildWorldSimulationMotivationalGoalEvents,
  buildWorldSimulationMotivationalGoalResolverView,
  projectWorldSimulationEffectiveMotivationalGoals,
  projectWorldSimulationMotivationalGoalsForCharacter,
  worldSimulationMotivationGoalIntegrationVersion,
} from "../../server/src/world-simulation-motivation-goal-integration-service.mjs";

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function interpretationHash(event) {
  const body = clone(event);
  delete body.interpretation_event_hash;
  return hashAgentRunValue(body);
}
function makeInterpretation(character, turnId) {
  const event = {
    schema_version: autobiographicalSelfInterpretationEventSchemaVersion,
    version: worldSimulationAutobiographicalSelfInterpretationVersion,
    immutable: true,
    character,
    source_turn_id: turnId,
    operation: "establish",
    interpretation_id: `interpretation_${turnId}`,
    interpretation_kind: "continuity",
    source_refs: [{
      source_kind: "phase67b_life_event_organization",
      source_event_id: `life_event_${turnId}`,
      source_event_hash: `life_hash_${turnId}`,
    }],
    qualifiers: ["repeated_pattern"],
    supersedes_interpretation_ids: [],
    resolver_view_hash: `resolver_${turnId}`,
    previous_interpretation_event_id: null,
    previous_interpretation_event_hash: null,
    interpretation_evidence: {},
    source_semantics: {},
    subjective_not_world_truth: true,
    world_truth_verified: false,
    epistemic_belief: false,
    self_model: false,
    trait_model: false,
    value_model: false,
    preference_model: false,
    role_identity_model: false,
    capability_self_rating_model: false,
    motivation_goal_model: false,
    confidence: null,
    probability: null,
    freeform_life_story_authority: false,
    character_brain_direct_write: false,
    status: "autobiographical_self_interpretation_recorded",
    interpretation_event_id: `phase68a_event_${turnId}`,
  };
  event.interpretation_event_hash = interpretationHash(event);
  return event;
}
function interpretationRef(event) {
  return {
    schema_version: autobiographicalSelfInterpretationHistoryReferenceSchemaVersion,
    derived_index: true,
    interpretation_event_id: event.interpretation_event_id,
    interpretation_event_hash: event.interpretation_event_hash,
    interpretation_id: event.interpretation_id,
    character: event.character,
    source_turn_id: event.source_turn_id,
    operation: event.operation,
    interpretation_kind: event.interpretation_kind,
    supersedes_interpretation_ids: [],
    previous_interpretation_event_id: null,
    previous_interpretation_event_hash: null,
    status: event.status,
  };
}
function interpretationSource(event) {
  return {
    source_kind: "phase68a_autobiographical_self_interpretation",
    source_event_id: event.interpretation_event_id,
    source_event_hash: event.interpretation_event_hash,
  };
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
const rio = "里歐・瓦爾德";
const turn0 = "world_turn_phase68d_self_001";
const interpretation = makeInterpretation(elias, turn0);
let world = {
  autobiographical_self_interpretation_events: {
    [interpretation.interpretation_event_id]: interpretation,
  },
  autobiographical_self_interpretation_history: [interpretationRef(interpretation)],
};
const selfResolver = buildWorldSimulationStructuredSelfModelResolverView({ world_state: world, turn_id: turn0 });
const formed = buildWorldSimulationStructuredSelfModelAspects({
  world_state: world,
  turn_id: turn0,
  aspect_decisions: [{
    character: elias,
    operation: "form",
    aspect_type: "value_orientation",
    aspect_key: "protect_others",
    descriptor: {
      subject_scope: "self",
      domain: "relationships",
      relation: "values",
      object_ref: "protecting_companions",
      qualifiers: ["personally_endorsed"],
    },
    source_refs: [interpretationSource(interpretation)],
    resolver_view_hash: selfResolver.resolver_view_hash,
  }],
});
world = executeBuilt(world, turn0, "structured_self_model", formed);
const selfAspect = formed.result.aspect_events_created[0];

const contract = buildWorldSimulationMotivationGoalIntegrationContract();
assert.equal(contract.phase, "Phase68D");
assert.deepEqual(contract.supported_operations, ["propose", "commit", "suspend", "abandon"]);
assert.equal(contract.proposed_is_not_committed, true);
assert.equal(contract.action_planning_modeled, false);
assert.equal(contract.selected_action_authority_claimed, false);
assert.equal(contract.expected_utility_modeled, false);

const turn1 = "world_turn_phase68d_001";
const resolver1 = buildWorldSimulationMotivationalGoalResolverView({ world_state: world, turn_id: turn1 });
const selfSource = resolver1.available_motivation_basis_refs.find((ref) =>
  ref.source_kind === "phase68b_structured_self_model_aspect_event" && ref.source_event_id === selfAspect.aspect_event_id);
assert.ok(selfSource);
assert.equal(resolver1.raw_world_state_exposed, false);
assert.equal(resolver1.action_plan_requested, false);

const proposed = buildWorldSimulationMotivationalGoalEvents({
  world_state: world,
  turn_id: turn1,
  goal_decisions: [{
    character: elias,
    operation: "propose",
    goal_kind: "maintain_state",
    domain: "relationships",
    target_descriptor: { label: "keep_companions_safe", context: "academy_conflict" },
    motivation_basis_refs: [{
      source_kind: selfSource.source_kind,
      source_event_id: selfSource.source_event_id,
      source_event_hash: selfSource.source_event_hash,
    }],
    motivation_relations: ["self_concordant_with"],
    resolver_view_hash: resolver1.resolver_view_hash,
  }],
});
assert.equal(proposed.version, worldSimulationMotivationGoalIntegrationVersion);
const proposeEvent = proposed.result.goal_events_created[0];
assert.equal(proposeEvent.operation, "propose");
assert.equal(proposeEvent.committed_goal_is_selected_action, false);
assert.equal(proposeEvent.action_plan_generated, false);
assert.equal(proposeEvent.utility_score, null);
world = executeBuilt(world, turn1, "motivation_goal_integration", proposed);

let projection = projectWorldSimulationEffectiveMotivationalGoals({ world_state: world });
let goal = projection.goals_by_character[elias][proposeEvent.goal_id];
assert.equal(goal.state, "proposed");
assert.equal(projection.proposed_is_not_committed, true);
assert.equal(projection.last_write_wins_applied, false);
assert.equal(projection.numeric_utility_modeled, false);

const turn2 = "world_turn_phase68d_002";
const resolver2 = buildWorldSimulationMotivationalGoalResolverView({ world_state: world, turn_id: turn2 });
const committed = buildWorldSimulationMotivationalGoalEvents({
  world_state: world,
  turn_id: turn2,
  goal_decisions: [{
    character: elias,
    operation: "commit",
    goal_id: proposeEvent.goal_id,
    resolver_view_hash: resolver2.resolver_view_hash,
  }],
});
world = executeBuilt(world, turn2, "motivation_goal_integration", committed);
projection = projectWorldSimulationEffectiveMotivationalGoals({ world_state: world });
goal = projection.goals_by_character[elias][proposeEvent.goal_id];
assert.equal(goal.state, "committed");

assert.throws(
  () => projectWorldSimulationMotivationalGoalsForCharacter({
    world_state: world,
    character: elias,
    current_turn_id: turn2,
  }),
  (error) => error?.code === "WORLD_SIMULATION_MOTIVATIONAL_GOAL_SAME_TURN_CONTAMINATION",
);
const characterProjection = projectWorldSimulationMotivationalGoalsForCharacter({
  world_state: world,
  character: elias,
  current_turn_id: "world_turn_phase68d_003",
});
assert.equal(characterProjection.character_view.goals.length, 1);
assert.equal(characterProjection.character_view.goals[0].state, "committed");
assert.equal(characterProjection.audit.goal_ids_exposed, false);
assert.equal(characterProjection.audit.numeric_utility_priority_probability_exposed, false);
assert.equal(characterProjection.audit.action_plan_exposed, false);
assert.equal(characterProjection.audit.selected_action_authority_exposed, false);

const turn3 = "world_turn_phase68d_003";
const resolver3 = buildWorldSimulationMotivationalGoalResolverView({ world_state: world, turn_id: turn3 });
const suspended = buildWorldSimulationMotivationalGoalEvents({
  world_state: world,
  turn_id: turn3,
  goal_decisions: [{ character: elias, operation: "suspend", goal_id: proposeEvent.goal_id, resolver_view_hash: resolver3.resolver_view_hash }],
});
world = executeBuilt(world, turn3, "motivation_goal_integration", suspended);
assert.equal(projectWorldSimulationEffectiveMotivationalGoals({ world_state: world }).goals_by_character[elias][proposeEvent.goal_id].state, "suspended");

const turn4 = "world_turn_phase68d_004";
const resolver4 = buildWorldSimulationMotivationalGoalResolverView({ world_state: world, turn_id: turn4 });
const abandoned = buildWorldSimulationMotivationalGoalEvents({
  world_state: world,
  turn_id: turn4,
  goal_decisions: [{ character: elias, operation: "abandon", goal_id: proposeEvent.goal_id, resolver_view_hash: resolver4.resolver_view_hash }],
});
world = executeBuilt(world, turn4, "motivation_goal_integration", abandoned);
assert.equal(projectWorldSimulationEffectiveMotivationalGoals({ world_state: world }).goals_by_character[elias][proposeEvent.goal_id].state, "abandoned");

assert.throws(
  () => buildWorldSimulationMotivationalGoalEvents({
    world_state: world,
    turn_id: "world_turn_phase68d_illegal",
    goal_decisions: [{ character: elias, operation: "commit", goal_id: proposeEvent.goal_id }],
  }),
  (error) => error?.code === "WORLD_SIMULATION_MOTIVATIONAL_GOAL_STATE_TRANSITION_INVALID",
);

const rioInterpretation = makeInterpretation(rio, "world_turn_phase68d_rio");
const crossWorld = clone(world);
crossWorld.autobiographical_self_interpretation_events[rioInterpretation.interpretation_event_id] = rioInterpretation;
crossWorld.autobiographical_self_interpretation_history.push(interpretationRef(rioInterpretation));
const crossResolver = buildWorldSimulationMotivationalGoalResolverView({ world_state: crossWorld, turn_id: "world_turn_phase68d_cross" });
const rioSource = crossResolver.available_motivation_basis_refs.find((ref) => ref.character === rio);
assert.throws(
  () => buildWorldSimulationMotivationalGoalEvents({
    world_state: crossWorld,
    turn_id: "world_turn_phase68d_cross",
    goal_decisions: [{
      character: elias,
      operation: "propose",
      goal_kind: "avoid_state",
      domain: "combat",
      target_descriptor: { label: "avoid_injury" },
      motivation_basis_refs: [{ source_kind: rioSource.source_kind, source_event_id: rioSource.source_event_id, source_event_hash: rioSource.source_event_hash }],
      motivation_relations: ["externally_prompted_by"],
      resolver_view_hash: crossResolver.resolver_view_hash,
    }],
  }),
  (error) => error?.code === "WORLD_SIMULATION_MOTIVATIONAL_GOAL_CROSS_CHARACTER_SOURCE_FORBIDDEN",
);

// Native late writes may contain a new self-model source from this turn.
// Resolver admission must remain pinned to the prior committed snapshot.
const turn5 = "world_turn_phase68d_native_005";
const priorCommitted = {};
const turn5Interpretation = makeInterpretation(elias, turn5);
const turn5SelfWorld = {
  autobiographical_self_interpretation_events: {
    [turn5Interpretation.interpretation_event_id]: turn5Interpretation,
  },
  autobiographical_self_interpretation_history: [interpretationRef(turn5Interpretation)],
};
const sameTurnSelfView = buildWorldSimulationStructuredSelfModelResolverView({
  world_state: turn5SelfWorld, turn_id: turn5,
});
const sameTurnSelf = buildWorldSimulationStructuredSelfModelAspects({
  world_state: turn5SelfWorld, turn_id: turn5,
  aspect_decisions: [{
    character: elias, operation: "form", aspect_type: "value_orientation",
    aspect_key: "learning_together",
    descriptor: { subject_scope: "self", domain: "learning", relation: "values",
      object_ref: "learning_with_companions", qualifiers: ["personally_endorsed"] },
    source_refs: [interpretationSource(turn5Interpretation)],
    resolver_view_hash: sameTurnSelfView.resolver_view_hash,
  }],
});
const currentWithSameTurnSelf = executeBuilt(turn5SelfWorld, turn5, "structured_self_model", sameTurnSelf);
const lateView = buildWorldSimulationMotivationalGoalResolverView({
  world_state: currentWithSameTurnSelf, turn_id: turn5,
});
const lateSource = lateView.available_motivation_basis_refs.find((ref) =>
  ref.source_event_id === sameTurnSelf.result.aspect_events_created[0].aspect_event_id);
assert.ok(lateSource);
assert.throws(() => buildWorldSimulationMotivationalGoalEvents({
  world_state: currentWithSameTurnSelf,
  resolver_world_state: priorCommitted,
  turn_id: turn5,
  goal_decisions: [{
    character: elias, operation: "propose", goal_kind: "maintain_state",
    domain: "learning", target_descriptor: { label: "learn_together" },
    motivation_basis_refs: [{ source_kind: lateSource.source_kind,
      source_event_id: lateSource.source_event_id,
      source_event_hash: lateSource.source_event_hash }],
    resolver_view_hash: buildWorldSimulationMotivationalGoalResolverView({
      world_state: priorCommitted, turn_id: turn5,
    }).resolver_view_hash,
  }],
}), (error) => error?.code === "WORLD_SIMULATION_MOTIVATIONAL_GOAL_SOURCE_OUT_OF_VIEW");

const queueContract = buildWorldSimulationChronologicalMutationQueueContract();
assert.equal(queueContract.execution.phase68d_motivational_goal_event_write_once_enforced, true);
assert.equal(queueContract.execution.phase68d_explicit_goal_state_transition_enforced, true);
assert.equal(queueContract.execution.phase68d_action_plan_authority_rejected, true);

const replayA = projectWorldSimulationEffectiveMotivationalGoals({ world_state: world });
const replayB = projectWorldSimulationEffectiveMotivationalGoals({ world_state: clone(world) });
assert.equal(replayA.projection_hash, replayB.projection_hash);
assert.equal(Object.hasOwn(world, "goal_plan"), false);
assert.equal(Object.hasOwn(world, "utility_function"), false);

// CB-C3: belief-only characters have a legitimate motivation basis even
// before any autobiographical interpretation or structured self aspect exists.
const beliefTurn = "world_turn_cbc3_belief_source";
const beliefMemory = {
  memory_id: "memory_cbc3_belief_source",
  memory_type: "episodic_direct_perception",
  content: { kind: "visual_observation", description: "看見同伴在門口等待。" },
  source: { kind: "direct_perception", sense: "visual" },
  internal_provenance: {
    event_id: "event_cbc3_belief_source", scene_id: "scene_cbc3",
    turn_id: beliefTurn, observation_hash: "observation_cbc3",
    formation_version: "phase63a-subjective-memory-formation-v1",
  },
  formation_stage: "encoded_unconsolidated",
  engine_persisted_trace: true, last_recalled_at: null,
  accessible: true, suppressed: false, possibly_incorrect: false,
  source_confused: false, subjective_memory_not_world_truth: true,
};
let beliefOnlyWorld = { memories: { [rio]: [beliefMemory] } };
const beliefClaim = buildWorldSimulationSubjectiveClaims({
  world_state: beliefOnlyWorld, turn_id: beliefTurn,
  source_memory_records: [{ character: rio, memory_record: beliefMemory }],
  claim_proposals: [{
    proposal_ref: "cbc3-companion-waiting", character: rio,
    proposition: "同伴可能正在等我。",
    evidence: [{ source_memory_ref: beliefMemory.memory_id, relation: "supports" }],
  }],
});
beliefOnlyWorld = executeBuilt(beliefOnlyWorld, beliefTurn, "subjective_claim", beliefClaim);
const beliefResolution = resolveWorldSimulationSubjectiveBeliefs({
  world_state: beliefOnlyWorld, turn_id: beliefTurn,
});
const beliefRevision = buildWorldSimulationSubjectiveBeliefRevisions({
  world_state: beliefOnlyWorld, turn_id: beliefTurn,
  resolution: beliefResolution.result,
});
beliefOnlyWorld = executeBuilt(beliefOnlyWorld, beliefTurn, "subjective_belief_revision", beliefRevision);
assert.equal(beliefOnlyWorld.autobiographical_self_interpretation_history, undefined);
assert.equal(beliefOnlyWorld.structured_self_model_aspect_history, undefined);
const beliefGoalView = buildWorldSimulationMotivationalGoalResolverView({
  world_state: beliefOnlyWorld, turn_id: "world_turn_cbc3_next",
});
const beliefSource = beliefGoalView.available_motivation_basis_refs.find(
  (ref) => ref.character === rio && ref.source_kind === "phase66_subjective_belief_revision_event",
);
assert.ok(beliefSource, "active belief is visible without any prior self-model record");
assert.equal(beliefSource.character_view.subjective_not_world_truth, true);
const beliefGoal = buildWorldSimulationMotivationalGoalEvents({
  world_state: beliefOnlyWorld, turn_id: "world_turn_cbc3_next",
  goal_decisions: [{
    character: rio, operation: "propose", goal_kind: "achieve_state",
    domain: "relationships", target_descriptor: { label: "meet_companion" },
    motivation_basis_refs: [{
      source_kind: beliefSource.source_kind,
      source_event_id: beliefSource.source_event_id,
      source_event_hash: beliefSource.source_event_hash,
    }],
    resolver_view_hash: beliefGoalView.resolver_view_hash,
  }],
});
assert.equal(beliefGoal.result.goal_events_created[0].operation, "propose");
assert.equal(beliefGoal.result.goal_events_created[0].committed_goal_is_selected_action, false);
const tamperedBeliefWorld = clone(beliefOnlyWorld);
const tamperedBeliefEventId = tamperedBeliefWorld.subjective_belief_revision_history[0]
  .belief_revision_event_id;
tamperedBeliefWorld.subjective_belief_revision_events[tamperedBeliefEventId]
  .resolution_reason = "forged";
assert.throws(
  () => buildWorldSimulationMotivationalGoalResolverView({
    world_state: tamperedBeliefWorld, turn_id: "world_turn_cbc3_tampered",
  }),
  (error) => error?.code === "WORLD_SIMULATION_EFFECTIVE_SUBJECTIVE_BELIEF_REVISION_EVENT_HASH_MISMATCH",
);
assert.deepEqual(
  buildWorldSimulationMotivationalGoalResolverView({
    world_state: { subjective_belief_revision_events: beliefOnlyWorld.subjective_belief_revision_events },
    turn_id: "world_turn_cbc3_orphan",
  }).available_motivation_basis_refs,
  [],
  "unreferenced belief events cannot become motivation sources",
);

console.log("Phase68D motivation / goal integration tests passed.");
