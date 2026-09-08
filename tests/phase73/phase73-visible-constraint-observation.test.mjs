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
  meansFeasibilityEventSchemaVersion,
  meansFeasibilityHistoryReferenceSchemaVersion,
  worldSimulationMeansFeasibilityVersion,
} from "../../server/src/world-simulation-means-feasibility-service.mjs";
import {
  buildWorldSimulationVisibleConstraintObservationContract,
  buildWorldSimulationVisibleConstraintObservations,
  projectWorldSimulationVisibleConstraintObservationsForCharacter,
  visibleConstraintObservationCharacterProjectionVersion,
  worldSimulationVisibleConstraintObservationVersion,
} from "../../server/src/world-simulation-visible-constraint-observation-service.mjs";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
function hashWithout(value, field) {
  const body = clone(value);
  delete body[field];
  return hashAgentRunValue(body);
}
function makeEvidenceEntry(turnId, kind, index, evidence) {
  const evidenceHash = hashAgentRunValue(evidence);
  return {
    evidence_ref: `phase72_evidence_${hashAgentRunValue({
      version: worldSimulationMeansFeasibilityVersion,
      turn_id: turnId,
      kind,
      index,
      evidence_hash: evidenceHash,
    }).slice(0, 24)}`,
    evidence_kind: kind,
    evidence_index: index,
    evidence_hash: evidenceHash,
    evidence_character: evidence.character ?? evidence.actor ?? evidence.character_name ?? null,
    evidence,
  };
}
function makePhase72Context(turnId, evidenceEntries) {
  const context = {
    version: worldSimulationMeansFeasibilityVersion,
    turn_id: turnId,
    resolver_view_hash: `phase72_resolver_${turnId}`,
    source_plans: [],
    authoritative_evidence: evidenceEntries,
    bounded_current_turn_engine_evidence_catalog: true,
    complete_coverage_required_to_claim_feasible: true,
    physical_executability_required_to_claim_feasible: true,
    character_visible_evidence_is_explicit_subset_only: true,
    raw_world_state_exposed: false,
  };
  context.context_hash = hashAgentRunValue(context);
  return context;
}
function makePhase72Event(turnId, context, evidenceRef, character = CHARACTER) {
  const event = {
    schema_version: meansFeasibilityEventSchemaVersion,
    version: worldSimulationMeansFeasibilityVersion,
    immutable: true,
    character,
    source_turn_id: turnId,
    operation: "verify_means_feasibility",
    goal_id: "phase73_goal",
    source_plan_ref: "phase72_source_phase73_plan",
    implementation_intention_id: "phase73_plan",
    target_source_kind: "phase69a_goal_implementation_intention_event",
    target_source_event_id: "phase69a_event_phase73",
    target_source_event_hash: "phase69a_event_hash_phase73",
    cue_descriptor: {
      cue_kind: "obstacle",
      label: "wall_route",
    },
    response_descriptor: {
      response_kind: "initiate_behavior",
      label: "climb_wall",
    },
    source_plan_projection_hash: "phase73_plan_projection_hash",
    constraint_checks: [{
      constraint_kind: "environment",
      constraint_code: "surface_not_climbable",
      constraint_status: "unsatisfied",
      evidence_refs: [evidenceRef],
      required_for_execution: true,
    }],
    coverage_complete: true,
    means_status: "blocked",
    physical_executability: "blocked",
    authorization_status: "not_applicable",
    authoritative_evidence_catalog_hash: hashAgentRunValue(context.authoritative_evidence),
    character_visible_evidence_refs: [evidenceRef],
    resolver_view_hash: context.resolver_view_hash,
    previous_means_feasibility_event_id: null,
    previous_means_feasibility_event_hash: null,
    engine_authoritative_constraint_validation: true,
    world_truth_is_not_character_knowledge: true,
    character_knowledge_updated: false,
    character_visible_evidence_subset_only: true,
    means_blocked_implies_goal_unattainable: false,
    means_blocked_implies_plan_abandonment: false,
    alternative_means_generated: false,
    goal_state_mutated: false,
    plan_lifecycle_mutated: false,
    same_turn_replanning_triggered: false,
    arbitrary_world_state_search_used: false,
    utility_score: null,
    success_probability: null,
    feasibility_score: null,
    character_brain_direct_write: false,
    status: "goal_implementation_intention_means_feasibility_recorded",
    means_feasibility_event_id: `goal_implementation_intention_means_feasibility_event_${turnId}`,
  };
  event.means_feasibility_event_hash = hashWithout(event, "means_feasibility_event_hash");
  return event;
}
function phase72HistoryRef(event) {
  return {
    schema_version: meansFeasibilityHistoryReferenceSchemaVersion,
    derived_index: true,
    means_feasibility_event_id: event.means_feasibility_event_id,
    means_feasibility_event_hash: event.means_feasibility_event_hash,
    character: event.character,
    source_turn_id: event.source_turn_id,
    goal_id: event.goal_id,
    implementation_intention_id: event.implementation_intention_id,
    means_status: event.means_status,
    previous_means_feasibility_event_id: event.previous_means_feasibility_event_id,
    previous_means_feasibility_event_hash: event.previous_means_feasibility_event_hash,
    status: event.status,
  };
}
function makeWorld(event) {
  return {
    goal_implementation_intention_means_feasibility_events: {
      [event.means_feasibility_event_id]: clone(event),
    },
    goal_implementation_intention_means_feasibility_history: [phase72HistoryRef(event)],
  };
}
function buildPhase73(world, turnId, sourceRevision, sourceEvent, context) {
  return buildWorldSimulationVisibleConstraintObservations({
    world_state: world,
    turn_id: turnId,
    source_state_revision: sourceRevision,
    means_feasibility_events: [sourceEvent],
    phase72_authoritative_validation_context: context,
  });
}
function buildPhase73Queue(world, turnId, built, validationContext = built.result.authoritative_validation_context) {
  const input = {
    turn_id: `${turnId}:visible_constraint_observation`,
    world_state_hash: hashAgentRunValue(world),
    state_transitions: built.result.state_transitions,
    elapsed_ms: 0,
  };
  if (validationContext) {
    input.validation_context = {
      visible_constraint_observation: validationContext,
    };
  }
  return buildWorldSimulationChronologicalMutationQueue(input);
}

const CHARACTER = "伊萊亞斯・諾爾";
const OTHER_CHARACTER = "莉亞・艾爾文";
const TURN = "phase73a_visible_constraint_turn";
const SOURCE_REVISION = 10;

const outcomeEvidence = makeEvidenceEntry(
  TURN,
  "action_outcome",
  0,
  {
    actor: CHARACTER,
    action_id: "engine_action_secret_001",
    result: "blocked",
    blocker: "wet_surface_slipped_under_hand",
    means_status: "blocked_should_not_leak",
    internal_diagnostic: "engine_only_diagnostic",
  },
);
const phase72Context = makePhase72Context(TURN, [outcomeEvidence]);
const phase72Event = makePhase72Event(TURN, phase72Context, outcomeEvidence.evidence_ref);
const world = makeWorld(phase72Event);

const contract = buildWorldSimulationVisibleConstraintObservationContract();
assert.equal(contract.phase, "Phase73A");
assert.equal(contract.version, worldSimulationVisibleConstraintObservationVersion);
assert.equal(contract.phase72_world_truth_verdict_directly_exposed, false);
assert.equal(contract.observer_scope_required, true);
assert.equal(contract.cross_character_exposure_allowed, false);
assert.equal(contract.direct_subjective_memory_write, false);
assert.equal(contract.direct_subjective_claim_or_belief_write, false);
assert.equal(contract.direct_current_mind_write, false);
assert.equal(contract.same_turn_cognition_feedback_allowed, false);
assert.equal(contract.same_turn_replanning_triggered, false);
assert.equal(contract.delivery_window, "exactly_next_committed_state_revision");

const queueContract = buildWorldSimulationChronologicalMutationQueueContract();
assert.equal(queueContract.execution.phase73a_visible_constraint_observation_event_write_once_enforced, true);
assert.equal(queueContract.execution.phase73a_phase72_source_event_hash_pinning_enforced, true);
assert.equal(queueContract.execution.phase73a_phase72_character_visible_subset_membership_verified, true);
assert.equal(queueContract.execution.phase73a_cross_character_evidence_rejected, true);
assert.equal(queueContract.execution.phase73a_character_facing_payload_recomputed_from_canonical_evidence, true);
assert.equal(queueContract.execution.phase73a_actual_means_feasibility_verdict_exposure_rejected, true);
assert.equal(queueContract.execution.phase73a_next_committed_revision_delivery_enforced, true);
assert.equal(queueContract.execution.phase73a_same_turn_cognition_feedback_rejected, true);
assert.equal(queueContract.execution.phase73a_authoritative_queue_validator_invoked, true);

const built = buildPhase73(world, TURN, SOURCE_REVISION, phase72Event, phase72Context);
assert.equal(built.result.visible_observation_count, 1);
assert.equal(built.result.history_references_appended.length, 1);
assert.equal(built.result.audit.phase72_character_visible_subset_only, true);
assert.equal(built.result.audit.next_committed_revision_only, true);
assert.equal(built.result.audit.actual_means_feasibility_verdict_exposed, false);
const observation = built.result.observation_events_created[0];
assert.equal(observation.character, CHARACTER);
assert.equal(observation.source_state_revision, SOURCE_REVISION);
assert.equal(observation.deliver_at_state_revision, SOURCE_REVISION + 1);
assert.equal(observation.source_means_feasibility_event_id, phase72Event.means_feasibility_event_id);
assert.equal(observation.source_evidence_ref, outcomeEvidence.evidence_ref);
assert.equal(observation.perceptual_channel, "other_senses");
assert.equal(observation.actual_means_feasibility_verdict_exposed, false);
assert.equal(observation.world_truth_authority_exposed, false);
assert.equal(observation.direct_belief_write, false);
assert.equal(observation.direct_subjective_memory_write, false);
assert.equal(observation.direct_current_mind_write, false);
assert.equal(observation.same_turn_cognition_feedback_allowed, false);
assert.equal(observation.same_turn_replanning_triggered, false);
assert.equal(observation.cross_character_exposure_allowed, false);

const characterFacing = observation.character_facing_observation;
assert.equal(characterFacing.modality, "constraint_related");
assert.equal(characterFacing.evidence_kind, "action_outcome");
assert.equal(characterFacing.world_truth_authority, false);
assert.equal(characterFacing.subjective_interpretation_required, true);
assert.equal(characterFacing.actual_means_feasibility_verdict_exposed, false);
assert.equal(characterFacing.perceived_evidence.actor, CHARACTER);
assert.equal(characterFacing.perceived_evidence.result, "blocked");
assert.equal(characterFacing.perceived_evidence.blocker, "wet_surface_slipped_under_hand");
assert.equal(characterFacing.perceived_evidence.action_id, undefined);
assert.equal(characterFacing.perceived_evidence.means_status, undefined);
assert.equal(characterFacing.perceived_evidence.internal_diagnostic, undefined);
assert.equal(JSON.stringify(characterFacing).includes(phase72Event.means_feasibility_event_id), false);

const queue = buildPhase73Queue(world, TURN, built);
const projected = projectWorldSimulationChronologicalMutationQueue({
  world_state: world,
  preview_world_state: built.result.preview_world_state,
  queue,
});
assert.equal(projected.projected_world_state.visible_constraint_observation_history.length, 1);
const executed = executeWorldSimulationChronologicalMutationQueue({
  world_state: world,
  preview_world_state: built.result.preview_world_state,
  queue,
});
const committedWorld = executed.next_world_state;
assert.equal(committedWorld.visible_constraint_observation_history.length, 1);

const sameTurnProjection = projectWorldSimulationVisibleConstraintObservationsForCharacter({
  world_state: committedWorld,
  character: CHARACTER,
  state_revision: SOURCE_REVISION,
});
assert.equal(sameTurnProjection.character_view.observation_count, 0);

const nextRevisionProjection = projectWorldSimulationVisibleConstraintObservationsForCharacter({
  world_state: committedWorld,
  character: CHARACTER,
  state_revision: SOURCE_REVISION + 1,
});
assert.equal(nextRevisionProjection.version, visibleConstraintObservationCharacterProjectionVersion);
assert.equal(nextRevisionProjection.character_view.observation_count, 1);
assert.deepEqual(nextRevisionProjection.character_view.other_senses, [characterFacing]);
assert.equal(nextRevisionProjection.character_view.actual_means_feasibility_verdict_exposed, false);
assert.equal(nextRevisionProjection.audit.engine_source_event_ids_exposed, false);
assert.equal(nextRevisionProjection.audit.engine_evidence_refs_exposed, false);

const otherCharacterProjection = projectWorldSimulationVisibleConstraintObservationsForCharacter({
  world_state: committedWorld,
  character: OTHER_CHARACTER,
  state_revision: SOURCE_REVISION + 1,
});
assert.equal(otherCharacterProjection.character_view.observation_count, 0);

const laterRevisionProjection = projectWorldSimulationVisibleConstraintObservationsForCharacter({
  world_state: committedWorld,
  character: CHARACTER,
  state_revision: SOURCE_REVISION + 2,
});
assert.equal(laterRevisionProjection.character_view.observation_count, 0);

const forgedBuilt = clone(built);
const forgedEvent = forgedBuilt.result.observation_events_created[0];
forgedEvent.character_facing_observation.perceived_evidence.forged_means_status = "blocked";
forgedEvent.observation_event_hash = hashWithout(forgedEvent, "observation_event_hash");
forgedBuilt.result.history_references_appended[0].observation_event_hash = forgedEvent.observation_event_hash;
forgedBuilt.result.preview_world_state.visible_constraint_observation_events[forgedEvent.observation_event_id] = clone(forgedEvent);
forgedBuilt.result.preview_world_state.visible_constraint_observation_history[0].observation_event_hash = forgedEvent.observation_event_hash;
for (const transition of forgedBuilt.result.state_transitions) {
  if (transition.field.startsWith("visible_constraint_observation_events.")) {
    transition.to = clone(forgedEvent);
  } else if (transition.field === "visible_constraint_observation_history") {
    transition.to = clone(forgedBuilt.result.preview_world_state.visible_constraint_observation_history);
  }
}
const forgedQueue = buildPhase73Queue(world, TURN, forgedBuilt);
assert.throws(
  () => executeWorldSimulationChronologicalMutationQueue({
    world_state: world,
    preview_world_state: forgedBuilt.result.preview_world_state,
    queue: forgedQueue,
  }),
  (error) => error?.code === "WORLD_SIMULATION_VISIBLE_CONSTRAINT_OBSERVATION_CHARACTER_PAYLOAD_INVALID",
);

const noContextQueue = buildPhase73Queue(world, TURN, built, null);
assert.throws(
  () => projectWorldSimulationChronologicalMutationQueue({
    world_state: world,
    preview_world_state: built.result.preview_world_state,
    queue: noContextQueue,
  }),
  (error) => error?.code === "WORLD_SIMULATION_VISIBLE_CONSTRAINT_OBSERVATION_VALIDATION_CONTEXT_REQUIRED",
);
assert.throws(
  () => executeWorldSimulationChronologicalMutationQueue({
    world_state: world,
    preview_world_state: built.result.preview_world_state,
    queue: noContextQueue,
  }),
  (error) => error?.code === "WORLD_SIMULATION_VISIBLE_CONSTRAINT_OBSERVATION_VALIDATION_CONTEXT_REQUIRED",
);

const worldWithoutPhase72History = clone(world);
delete worldWithoutPhase72History.goal_implementation_intention_means_feasibility_history;
assert.throws(
  () => buildPhase73(
    worldWithoutPhase72History,
    TURN,
    SOURCE_REVISION,
    phase72Event,
    phase72Context,
  ),
  (error) => error?.code === "WORLD_SIMULATION_VISIBLE_CONSTRAINT_OBSERVATION_SOURCE_EVENT_INVALID",
);

const foreignEvidence = makeEvidenceEntry(
  "phase73a_foreign_turn",
  "action_outcome",
  0,
  {
    actor: OTHER_CHARACTER,
    result: "blocked",
    blocker: "foreign_private_failure",
  },
);
const foreignContext = makePhase72Context("phase73a_foreign_turn", [foreignEvidence]);
const foreignEvent = makePhase72Event(
  "phase73a_foreign_turn",
  foreignContext,
  foreignEvidence.evidence_ref,
  CHARACTER,
);
const foreignWorld = makeWorld(foreignEvent);
assert.throws(
  () => buildPhase73(
    foreignWorld,
    "phase73a_foreign_turn",
    SOURCE_REVISION,
    foreignEvent,
    foreignContext,
  ),
  (error) => error?.code === "WORLD_SIMULATION_VISIBLE_CONSTRAINT_OBSERVATION_CROSS_CHARACTER_FORBIDDEN",
);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const loopSource = fs.readFileSync(
  path.resolve(__dirname, "../../server/src/world-simulation-loop-service.mjs"),
  "utf8",
);
const feasibilityIndex = loopSource.indexOf("const meansFeasibilityDecisionResolution =");
const observationBuildIndex = loopSource.indexOf("const visibleConstraintObservation =", feasibilityIndex);
const commitIndex = loopSource.indexOf("commitWorldSimulationTurn", observationBuildIndex);
assert.ok(
  feasibilityIndex >= 0
    && observationBuildIndex > feasibilityIndex
    && commitIndex > observationBuildIndex,
  "Phase73A must run after Phase72 and before atomic world commit.",
);
assert.match(
  loopSource.slice(observationBuildIndex, commitIndex),
  /visibleConstraintObservationMutationExecution/,
);
assert.match(
  loopSource.slice(commitIndex, commitIndex + 1400),
  /next_world_state:\s*visibleConstraintObservationMutationExecution\.next_world_state/,
);
const prepareProjectionIndex = loopSource.indexOf(
  "const visibleConstraintObservationProjection =",
);
const memoryAccessibilityIndex = loopSource.indexOf(
  "const memoryAccessibilityBaseInput =",
  prepareProjectionIndex,
);
assert.ok(
  prepareProjectionIndex >= 0 && memoryAccessibilityIndex > prepareProjectionIndex,
  "Phase73A observation projection must enter bounded perception before memory accessibility/retrieval.",
);
assert.match(
  loopSource.slice(prepareProjectionIndex, memoryAccessibilityIndex),
  /characterPerception\.other_senses/,
);
assert.doesNotMatch(
  loopSource.slice(prepareProjectionIndex, memoryAccessibilityIndex),
  /means_status|physical_executability|authorization_status/,
);

console.log("Phase73A visible constraint observation tests passed.");
