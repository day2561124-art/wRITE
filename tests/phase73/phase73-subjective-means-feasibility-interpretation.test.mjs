import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import {
  buildWorldSimulationChronologicalMutationQueue,
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
  buildWorldSimulationSubjectiveClaims,
  worldSimulationSubjectiveClaimProjectionVersion,
} from "../../server/src/world-simulation-subjective-claim-projection-service.mjs";
import {
  buildWorldSimulationSubjectiveMeansFeasibilityClaimProposals,
  buildWorldSimulationSubjectiveMeansFeasibilityInterpretationContract,
  buildWorldSimulationSubjectiveMeansFeasibilityResolverView,
  worldSimulationSubjectiveMeansFeasibilityInterpretationVersion,
} from "../../server/src/world-simulation-subjective-means-feasibility-interpretation-service.mjs";

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
      context: "phase73b_acceptance",
    },
    motivation_basis_refs: [{
      source_kind: "phase68b_structured_self_model_aspect_event",
      source_event_id: "phase73b_source_aspect",
      source_event_hash: "phase73b_source_aspect_hash",
    }],
    motivation_relations: ["self_concordant_with"],
    resolver_view_hash: `phase73b_goal_resolver_${turnId}`,
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
    goal_event_id: `phase73b_goal_event_${turnId}`,
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

const CHARACTER = "伊萊亞斯・諾爾";
const OTHER_CHARACTER = "莉亞・艾爾文";
const GOAL_ID = "phase73b_goal_001";
const TURN = "phase73b_interpretation_turn";

const proposed = makeGoalEvent({
  character: CHARACTER,
  goalId: GOAL_ID,
  turnId: "phase73b_goal_propose",
  operation: "propose",
});
const committed = makeGoalEvent({
  character: CHARACTER,
  goalId: GOAL_ID,
  turnId: "phase73b_goal_commit",
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
  turn_id: "phase73b_plan_formation",
});
const planBuilt = buildWorldSimulationGoalImplementationIntentionEvents({
  world_state: world,
  turn_id: "phase73b_plan_formation",
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
world = executeBuilt(
  world,
  "phase73b_plan_formation",
  "goal_implementation_intention",
  planBuilt,
);
const sourcePlan = planBuilt.result.implementation_intention_events_created[0];

const constraintMemory = makeMemory(
  "phase73b_constraint_memory",
  TURN,
  {
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
  },
);
const ordinaryMemory = makeMemory(
  "phase73b_ordinary_memory",
  TURN,
  {
    modality: "ordinary_scene_detail",
    perceived_evidence: {
      detail: "a bell rang across the yard",
    },
    source: "ordinary_perception",
    world_truth_authority: false,
  },
);
const spoofedConstraintMemory = makeMemory(
  "phase73b_spoofed_constraint_memory",
  TURN,
  {
    modality: "constraint_related",
    evidence_kind: "action_outcome",
    perceived_evidence: {
      result: "blocked",
      blocker: "forged_scene_other_sense_that_only_looks_like_phase73a",
    },
    source: "character_visible_world_evidence",
    world_truth_authority: false,
    subjective_interpretation_required: true,
    actual_means_feasibility_verdict_exposed: false,
  },
);
const otherCharacterConstraintMemory = makeMemory(
  "phase73b_other_character_constraint_memory",
  TURN,
  {
    modality: "constraint_related",
    evidence_kind: "action_outcome",
    perceived_evidence: {
      result: "blocked",
      blocker: "other_character_private_failure",
    },
    source: "character_visible_world_evidence",
    world_truth_authority: false,
    subjective_interpretation_required: true,
    actual_means_feasibility_verdict_exposed: false,
  },
);
world.memories = {
  [CHARACTER]: [clone(constraintMemory), clone(ordinaryMemory), clone(spoofedConstraintMemory)],
  [OTHER_CHARACTER]: [clone(otherCharacterConstraintMemory)],
};
const sourceMemories = [
  sourceRecord(CHARACTER, constraintMemory),
  sourceRecord(CHARACTER, ordinaryMemory),
  sourceRecord(CHARACTER, spoofedConstraintMemory),
  sourceRecord(OTHER_CHARACTER, otherCharacterConstraintMemory),
];
const phase73aObservationProjections = [
  {
    character: CHARACTER,
    observation_content_hashes: [hashAgentRunValue(constraintMemory.content)],
  },
  {
    character: OTHER_CHARACTER,
    observation_content_hashes: [hashAgentRunValue(otherCharacterConstraintMemory.content)],
  },
];

const contract = buildWorldSimulationSubjectiveMeansFeasibilityInterpretationContract();
assert.equal(contract.phase, "Phase73B");
assert.equal(contract.version, worldSimulationSubjectiveMeansFeasibilityInterpretationVersion);
assert.equal(contract.task_and_situation_specific_interpretation_required, true);
assert.equal(contract.phase73a_engine_side_observation_content_hash_lineage_required, true);
assert.equal(contract.phase73a_lineage_catalog_exposed_to_interpreter, false);
assert.equal(contract.phase73a_source_means_binding_exposed, false);
assert.equal(contract.phase72_actual_means_status_exposed, false);
assert.equal(contract.subjective_assessment_may_diverge_from_actual_feasibility, true);
assert.equal(contract.uncertainty_preserved, true);
assert.equal(contract.ordinary_phase65_claim_proposals_only, true);
assert.equal(contract.phase65_conflict_and_phase66_belief_revision_reused, true);
assert.equal(contract.parallel_belief_store_created, false);
assert.equal(contract.automatic_belief_creation_without_interpreter, false);
assert.equal(contract.direct_subjective_belief_write_allowed, false);
assert.equal(contract.direct_plan_or_goal_mutation_allowed, false);
assert.equal(contract.same_turn_replanning_allowed, false);
assert.equal(contract.numeric_confidence_probability_modeled, false);

const resolverView = buildWorldSimulationSubjectiveMeansFeasibilityResolverView({
  world_state: world,
  turn_id: TURN,
  source_memory_records: sourceMemories,
  phase73a_observation_projections: phase73aObservationProjections,
});
assert.equal(resolverView.version, worldSimulationSubjectiveMeansFeasibilityInterpretationVersion);
assert.equal(resolverView.character_contexts.length, 2);
const characterContext = resolverView.character_contexts.find((entry) => entry.character === CHARACTER);
const otherContext = resolverView.character_contexts.find((entry) => entry.character === OTHER_CHARACTER);
assert.ok(characterContext);
assert.ok(otherContext);
assert.deepEqual(
  characterContext.constraint_memories.map((memory) => memory.source_memory_ref),
  [constraintMemory.memory_id],
  "Only memories pinned to an engine-side Phase73A observation content hash may enter the Phase73B source set.",
);
assert.deepEqual(
  otherContext.constraint_memories.map((memory) => memory.source_memory_ref),
  [otherCharacterConstraintMemory.memory_id],
);
assert.equal(characterContext.represented_means.length, 1);
assert.equal(characterContext.represented_means[0].goal_id, GOAL_ID);
assert.equal(
  characterContext.represented_means[0].implementation_intention_id,
  sourcePlan.implementation_intention_id,
);
assert.equal(characterContext.represented_means[0].objective_feasibility_verified, false);
assert.equal(otherContext.represented_means.length, 0);
assert.equal(resolverView.boundaries.phase73a_engine_side_observation_content_hash_lineage_required, true);
assert.equal(resolverView.boundaries.phase73a_lineage_catalog_exposed_to_interpreter, false);
assert.equal(resolverView.boundaries.raw_world_state_exposed, false);
assert.equal(resolverView.boundaries.raw_phase72_means_status_exposed, false);
assert.equal(resolverView.boundaries.raw_phase72_physical_executability_exposed, false);
assert.equal(resolverView.boundaries.raw_phase72_authorization_status_exposed, false);
assert.equal(resolverView.boundaries.phase73a_source_means_binding_exposed, false);
assert.equal(resolverView.boundaries.numeric_confidence_probability_requested, false);
assert.equal(resolverView.boundaries.same_turn_replanning_requested, false);

const noLineageResolverView = buildWorldSimulationSubjectiveMeansFeasibilityResolverView({
  world_state: world,
  turn_id: TURN,
  source_memory_records: sourceMemories,
  phase73a_observation_projections: [],
});
assert.equal(
  noLineageResolverView.character_contexts.length,
  0,
  "Phase73B must fail closed when no engine-side Phase73A observation lineage catalog is supplied.",
);

const targetMeans = characterContext.represented_means[0];
const blockedInterpretation = buildWorldSimulationSubjectiveMeansFeasibilityClaimProposals({
  resolver_view: resolverView,
  interpretation_decisions: [{
    character: CHARACTER,
    target_means_ref: targetMeans.means_ref,
    assessment: "perceived_blocked",
    proposition: "我認為現在用這個方式攀爬很可能做不到。",
    source_memory_refs: [constraintMemory.memory_id],
    grounding_refs: [],
  }],
});
assert.equal(blockedInterpretation.decisions.length, 1);
assert.equal(blockedInterpretation.claim_proposals.length, 1);
assert.equal(blockedInterpretation.audit.parallel_belief_store_created, false);
assert.equal(blockedInterpretation.audit.world_truth_authority_claimed, false);
assert.equal(blockedInterpretation.audit.same_turn_replanning_triggered, false);
assert.deepEqual(
  Object.keys(blockedInterpretation.claim_proposals[0]).sort(),
  ["character", "evidence", "proposal_ref", "proposition"],
  "Phase73B must emit only the sealed Phase65 proposal shape.",
);

const phase65Built = buildWorldSimulationSubjectiveClaims({
  world_state: world,
  turn_id: TURN,
  source_memory_records: sourceMemories,
  claim_proposals: blockedInterpretation.claim_proposals,
});
assert.equal(phase65Built.version, worldSimulationSubjectiveClaimProjectionVersion);
assert.equal(phase65Built.result.claim_events_created.length, 1);
const claimEvent = phase65Built.result.claim_events_created[0];
assert.equal(claimEvent.character, CHARACTER);
assert.equal(claimEvent.proposition, "我認為現在用這個方式攀爬很可能做不到。");
assert.equal(claimEvent.semantic_state.world_truth_verified, false);
assert.equal(claimEvent.semantic_state.confidence, null);
assert.equal(claimEvent.semantic_state.probability, null);
assert.equal(claimEvent.engine_audit.world_truth_authority_claimed, false);
assert.match(claimEvent.derivation.proposal_ref, /^phase73b_interpretation_/);
assert.deepEqual(
  claimEvent.evidence.map((evidence) => evidence.source_memory_ref),
  [constraintMemory.memory_id],
);

// Subjective interpretation is deliberately allowed to disagree with the
// apparent outcome in the memory. Phase73B validates provenance, not truth.
const optimisticInterpretation = buildWorldSimulationSubjectiveMeansFeasibilityClaimProposals({
  resolver_view: resolverView,
  interpretation_decisions: [{
    character: CHARACTER,
    target_means_ref: targetMeans.means_ref,
    assessment: "perceived_feasible",
    proposition: "剛才只是手滑，我認為重新調整抓點後仍然能爬上去。",
    source_memory_refs: [constraintMemory.memory_id],
    grounding_refs: [],
  }],
});
assert.equal(optimisticInterpretation.decisions[0].assessment, "perceived_feasible");
assert.equal(optimisticInterpretation.audit.objective_feasibility_verified, false);

const uncertainInterpretation = buildWorldSimulationSubjectiveMeansFeasibilityClaimProposals({
  resolver_view: resolverView,
  interpretation_decisions: [{
    character: CHARACTER,
    target_means_ref: targetMeans.means_ref,
    assessment: "uncertain",
    proposition: "我還不能確定現在這個攀爬方式是否可靠。",
    source_memory_refs: [constraintMemory.memory_id],
    grounding_refs: [],
  }],
});
assert.equal(uncertainInterpretation.decisions[0].assessment, "uncertain");

assert.throws(
  () => buildWorldSimulationSubjectiveMeansFeasibilityClaimProposals({
    resolver_view: resolverView,
    interpretation_decisions: [{
      character: CHARACTER,
      target_means_ref: targetMeans.means_ref,
      assessment: "perceived_blocked",
      proposition: "forged objective verdict",
      source_memory_refs: [constraintMemory.memory_id],
      grounding_refs: [],
      means_status: "blocked",
    }],
  }),
  (error) => error?.code === "WORLD_SIMULATION_SUBJECTIVE_MEANS_FEASIBILITY_AUTHORITY_FIELD_FORBIDDEN",
);
assert.throws(
  () => buildWorldSimulationSubjectiveMeansFeasibilityClaimProposals({
    resolver_view: resolverView,
    interpretation_decisions: [{
      character: CHARACTER,
      target_means_ref: targetMeans.means_ref,
      assessment: "perceived_blocked",
      proposition: "forged confidence",
      source_memory_refs: [constraintMemory.memory_id],
      grounding_refs: [],
      confidence: 0.99,
    }],
  }),
  (error) => error?.code === "WORLD_SIMULATION_SUBJECTIVE_MEANS_FEASIBILITY_AUTHORITY_FIELD_FORBIDDEN",
);
assert.throws(
  () => buildWorldSimulationSubjectiveMeansFeasibilityClaimProposals({
    resolver_view: resolverView,
    interpretation_decisions: [{
      character: CHARACTER,
      target_means_ref: targetMeans.means_ref,
      assessment: "perceived_blocked",
      proposition: "ordinary memory must not become Phase73B evidence",
      source_memory_refs: [ordinaryMemory.memory_id],
      grounding_refs: [],
    }],
  }),
  (error) => error?.code === "WORLD_SIMULATION_SUBJECTIVE_MEANS_FEASIBILITY_MEMORY_OUT_OF_CONTEXT",
);
assert.throws(
  () => buildWorldSimulationSubjectiveMeansFeasibilityClaimProposals({
    resolver_view: resolverView,
    interpretation_decisions: [{
      character: CHARACTER,
      target_means_ref: targetMeans.means_ref,
      assessment: "perceived_blocked",
      proposition: "a lookalike observation without Phase73A lineage must not become evidence",
      source_memory_refs: [spoofedConstraintMemory.memory_id],
      grounding_refs: [],
    }],
  }),
  (error) => error?.code === "WORLD_SIMULATION_SUBJECTIVE_MEANS_FEASIBILITY_MEMORY_OUT_OF_CONTEXT",
);
assert.throws(
  () => buildWorldSimulationSubjectiveMeansFeasibilityClaimProposals({
    resolver_view: resolverView,
    interpretation_decisions: [{
      character: OTHER_CHARACTER,
      target_means_ref: targetMeans.means_ref,
      assessment: "perceived_blocked",
      proposition: "cross-character means must be rejected",
      source_memory_refs: [otherCharacterConstraintMemory.memory_id],
      grounding_refs: [],
    }],
  }),
  (error) => error?.code === "WORLD_SIMULATION_SUBJECTIVE_MEANS_FEASIBILITY_MEANS_OUT_OF_CONTEXT",
);

const emptyInterpretation = buildWorldSimulationSubjectiveMeansFeasibilityClaimProposals({
  resolver_view: resolverView,
  interpretation_decisions: [],
});
assert.equal(emptyInterpretation.claim_proposals.length, 0);
assert.equal(emptyInterpretation.audit.parallel_belief_store_created, false);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const loopSource = fs.readFileSync(
  path.resolve(__dirname, "../../server/src/world-simulation-loop-service.mjs"),
  "utf8",
);
const memoryFormationIndex = loopSource.indexOf("const subjectiveMemoryFormation =");
const phase73bIndex = loopSource.indexOf(
  "const subjectiveMeansFeasibilityInterpretationResolution =",
  memoryFormationIndex,
);
const genericClaimIndex = loopSource.indexOf(
  "const subjectiveClaimProposalResolution =",
  phase73bIndex,
);
const phase65BuildIndex = loopSource.indexOf("const subjectiveClaimProjection =", genericClaimIndex);
const phase71Index = loopSource.indexOf("const adaptiveReplanningDecisionResolution =", phase65BuildIndex);
assert.ok(
  memoryFormationIndex >= 0
    && phase73bIndex > memoryFormationIndex
    && genericClaimIndex > phase73bIndex
    && phase65BuildIndex > genericClaimIndex
    && phase71Index > phase65BuildIndex,
  "Phase73B must consume current-turn subjective memory before Phase65 claim persistence and before later Phase71 execution.",
);
assert.match(
  loopSource.slice(phase73bIndex, phase65BuildIndex + 1200),
  /subjectiveMeansFeasibilityInterpretationResolution\.claim_proposals/,
);
const phase73bHelperIndex = loopSource.indexOf(
  "async function resolveSubjectiveMeansFeasibilityInterpretations(",
);
assert.ok(
  phase73bHelperIndex >= 0 && phase73bHelperIndex < phase73bIndex,
  "Phase73B helper must be defined before resolveWorldSimulationTurn uses it.",
);
assert.match(
  loopSource.slice(phase73bHelperIndex, phase73bHelperIndex + 1800),
  /phase73a_observation_projections:\s*preparedTurn\.visible_constraint_observation_projections/,
  "Phase73B must receive only the engine-side Phase73A projection lineage catalog from prepare.",
);
assert.match(
  loopSource.slice(phase71Index, phase71Index + 900),
  /resolveAdaptiveReplanningDecisions\(\s*snapshot\.state/,
  "Same-turn Phase71 must remain pinned to prior committed state rather than consuming new Phase73B cognition.",
);

console.log("Phase73B subjective means feasibility interpretation tests passed.");
