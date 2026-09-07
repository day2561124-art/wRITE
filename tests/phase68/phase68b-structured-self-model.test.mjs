import assert from "node:assert/strict";

import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import {
  buildWorldSimulationChronologicalMutationQueue,
  executeWorldSimulationChronologicalMutationQueue,
} from "../../server/src/world-simulation-chronological-mutation-queue-service.mjs";
import {
  autobiographicalSelfInterpretationEventSchemaVersion,
  autobiographicalSelfInterpretationHistoryReferenceSchemaVersion,
  worldSimulationAutobiographicalSelfInterpretationVersion,
} from "../../server/src/world-simulation-autobiographical-self-interpretation-service.mjs";
import {
  buildWorldSimulationStructuredSelfModelAspects,
  buildWorldSimulationStructuredSelfModelContract,
  buildWorldSimulationStructuredSelfModelResolverView,
  projectWorldSimulationEffectiveStructuredSelfModel,
  projectWorldSimulationStructuredSelfModelForCharacter,
  structuredSelfModelAspectEventSchemaVersion,
  structuredSelfModelHistoryReferenceSchemaVersion,
  worldSimulationStructuredSelfModelVersion,
} from "../../server/src/world-simulation-structured-self-model-service.mjs";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
function interpretationEventHash(event) {
  const body = clone(event);
  delete body.interpretation_event_hash;
  return hashAgentRunValue(body);
}
function phase68AEvent({ character, turnId, kind, qualifier }) {
  const interpretationId = `interpretation_${character}_${turnId}`;
  const event = {
    schema_version: autobiographicalSelfInterpretationEventSchemaVersion,
    version: worldSimulationAutobiographicalSelfInterpretationVersion,
    immutable: true,
    character,
    source_turn_id: turnId,
    operation: "establish",
    interpretation_id: interpretationId,
    interpretation_kind: kind,
    source_refs: [{
      source_kind: "phase67b_life_event_organization",
      source_event_id: `life_event_${character}_${turnId}`,
      source_event_hash: `hash_${character}_${turnId}`,
    }],
    qualifiers: [qualifier],
    supersedes_interpretation_ids: [],
    resolver_view_hash: `resolver_${character}_${turnId}`,
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
    interpretation_event_id: `phase68a_event_${character}_${turnId}`,
  };
  event.interpretation_event_hash = interpretationEventHash(event);
  return event;
}
function phase68ARef(event) {
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
function sourceRef(event) {
  return {
    source_kind: "phase68a_autobiographical_self_interpretation",
    source_event_id: event.interpretation_event_id,
    source_event_hash: event.interpretation_event_hash,
  };
}

const elias = "伊萊亞斯・諾爾";
const rio = "里歐";
const turn1 = "world_turn_phase68b_001";
const eliasInterpretation = phase68AEvent({
  character: elias,
  turnId: turn1,
  kind: "continuity",
  qualifier: "repeated_pattern",
});
const rioInterpretation = phase68AEvent({
  character: rio,
  turnId: turn1,
  kind: "contrast",
  qualifier: "counterpattern",
});
let world = {
  autobiographical_self_interpretation_events: {
    [eliasInterpretation.interpretation_event_id]: eliasInterpretation,
    [rioInterpretation.interpretation_event_id]: rioInterpretation,
  },
  autobiographical_self_interpretation_history: [
    phase68ARef(eliasInterpretation),
    phase68ARef(rioInterpretation),
  ],
};

const contract = buildWorldSimulationStructuredSelfModelContract();
assert.equal(contract.phase, "Phase68B");
assert.equal(contract.formation_only, true);
assert.equal(contract.revision_modeled, false);
assert.equal(contract.world_truth_authority_claimed, false);
assert.equal(contract.motivation_goal_selection_modeled, false);
assert.deepEqual(contract.supported_aspect_types, [
  "trait_tendency",
  "value_orientation",
  "preference",
  "role_identity",
  "capability_appraisal",
]);

const resolver = buildWorldSimulationStructuredSelfModelResolverView({
  world_state: world,
  turn_id: turn1,
});
assert.equal(resolver.current_turn_interpretation_refs.length, 2);
assert.equal(resolver.raw_world_state_exposed, false);
assert.equal(resolver.phase67_store_exposed, false);
assert.equal(resolver.self_model_accuracy_requested, false);
assert.equal(resolver.motivation_goal_selection_requested, false);

const first = buildWorldSimulationStructuredSelfModelAspects({
  world_state: world,
  turn_id: turn1,
  aspect_decisions: [{
    character: elias,
    operation: "form",
    aspect_type: "trait_tendency",
    aspect_key: "approach_under_pressure",
    descriptor: {
      subject_scope: "self",
      domain: "conflict_response",
      relation: "tends_toward",
      object_ref: "direct_engagement",
      qualifiers: ["context_sensitive"],
    },
    source_refs: [sourceRef(eliasInterpretation)],
    resolver_view_hash: resolver.resolver_view_hash,
  }],
});
assert.equal(first.version, worldSimulationStructuredSelfModelVersion);
assert.equal(first.result.aspect_events_created.length, 1);
assert.equal(first.result.history_references_appended.length, 1);
const firstEvent = first.result.aspect_events_created[0];
assert.equal(firstEvent.schema_version, structuredSelfModelAspectEventSchemaVersion);
assert.equal(firstEvent.operation, "form");
assert.equal(firstEvent.self_model_content, true);
assert.equal(firstEvent.subjective_not_world_truth, true);
assert.equal(firstEvent.world_truth_verified, false);
assert.equal(firstEvent.epistemic_belief, false);
assert.equal(firstEvent.self_model_accuracy_claimed, false);
assert.equal(firstEvent.self_model_clarity_claimed, false);
assert.equal(firstEvent.confidence, null);
assert.equal(firstEvent.probability, null);
assert.equal(firstEvent.personality_score, null);
assert.equal(firstEvent.capability_score, null);
assert.equal(firstEvent.motivation_goal_model, false);
assert.equal(firstEvent.source_semantics.phase68a_rewritten, false);
assert.equal(firstEvent.source_semantics.raw_memory_scanned, false);
assert.equal(firstEvent.source_semantics.phase67_store_scanned, false);
assert.equal(firstEvent.source_semantics.self_model_revision_modeled, false);
assert.equal(firstEvent.source_semantics.motivation_goal_selection_modeled, false);
assert.equal(first.result.preview_world_state.autobiographical_self_interpretation_events[eliasInterpretation.interpretation_event_id].interpretation_event_hash,
  eliasInterpretation.interpretation_event_hash);
assert.equal(first.result.history_references_appended[0].schema_version,
  structuredSelfModelHistoryReferenceSchemaVersion);

const mutationQueue = buildWorldSimulationChronologicalMutationQueue({
  turn_id: `${turn1}:structured_self_model`,
  world_state_hash: hashAgentRunValue(world),
  state_transitions: first.result.state_transitions,
  elapsed_ms: 0,
});
const mutationExecution = executeWorldSimulationChronologicalMutationQueue({
  world_state: world,
  preview_world_state: first.result.preview_world_state,
  queue: mutationQueue,
});
assert.equal(mutationExecution.execution.sole_final_world_state_writer, true);
assert.equal(
  mutationExecution.next_world_state.structured_self_model_aspect_events[firstEvent.aspect_event_id].aspect_event_hash,
  firstEvent.aspect_event_hash,
);
assert.equal(mutationExecution.next_world_state.structured_self_model_history.length, 1);

world = mutationExecution.next_world_state;
const projection = projectWorldSimulationEffectiveStructuredSelfModel({ world_state: world });
assert.equal(projection.replayed_event_count, 1);
assert.equal(projection.formation_only, true);
assert.equal(projection.revision_applied, false);
assert.equal(projection.last_write_wins_applied, false);
assert.equal(projection.forced_cross_domain_consistency_applied, false);
const eliasAspects = Object.values(projection.aspects_by_character[elias]);
assert.equal(eliasAspects.length, 1);
assert.equal(eliasAspects[0].aspect_type, "trait_tendency");
assert.equal(eliasAspects[0].descriptor.relation, "tends_toward");

assert.throws(
  () => projectWorldSimulationStructuredSelfModelForCharacter({
    world_state: world,
    character: elias,
    current_turn_id: turn1,
  }),
  (error) => error?.code === "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_SAME_TURN_CONTAMINATION",
);
const nextTurn = "world_turn_phase68b_002";
const characterProjection = projectWorldSimulationStructuredSelfModelForCharacter({
  world_state: world,
  character: elias,
  current_turn_id: nextTurn,
});
assert.deepEqual(characterProjection.character_view.aspects, [{
  aspect_type: "trait_tendency",
  domain: "conflict_response",
  relation: "tends_toward",
  object: "direct_engagement",
  qualifiers: ["context_sensitive"],
  subjective_not_world_truth: true,
}]);
assert.equal(characterProjection.audit.aspect_ids_exposed, false);
assert.equal(characterProjection.audit.event_ids_exposed, false);
assert.equal(characterProjection.audit.source_ids_hashes_exposed, false);
assert.equal(characterProjection.audit.numeric_personality_capability_scores_exposed, false);

assert.throws(
  () => buildWorldSimulationStructuredSelfModelAspects({
    world_state: world,
    turn_id: turn1,
    aspect_decisions: [{
      character: elias,
      operation: "form",
      aspect_type: "preference",
      aspect_key: "second_same_turn",
      descriptor: {
        subject_scope: "self",
        domain: "social_context",
        relation: "prefers",
        object_ref: "small_groups",
        qualifiers: [],
      },
      source_refs: [sourceRef(eliasInterpretation)],
    }],
  }),
  (error) => error?.code === "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_PER_CHARACTER_TURN_LIMIT",
);

assert.throws(
  () => buildWorldSimulationStructuredSelfModelAspects({
    world_state: {
      autobiographical_self_interpretation_events: {
        [eliasInterpretation.interpretation_event_id]: eliasInterpretation,
        [rioInterpretation.interpretation_event_id]: rioInterpretation,
      },
      autobiographical_self_interpretation_history: [
        phase68ARef(eliasInterpretation),
        phase68ARef(rioInterpretation),
      ],
    },
    turn_id: turn1,
    aspect_decisions: [{
      character: elias,
      operation: "form",
      aspect_type: "role_identity",
      aspect_key: "cross_character_forbidden",
      descriptor: {
        subject_scope: "self",
        domain: "social_role",
        relation: "identifies_as",
        object_ref: "protector",
        qualifiers: [],
      },
      source_refs: [sourceRef(rioInterpretation)],
    }],
  }),
  (error) => error?.code === "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_CROSS_CHARACTER_SOURCE_FORBIDDEN",
);

assert.throws(
  () => buildWorldSimulationStructuredSelfModelAspects({
    world_state: world,
    turn_id: nextTurn,
    aspect_decisions: [{
      character: elias,
      operation: "form",
      aspect_type: "capability_appraisal",
      aspect_key: "no_current_trigger",
      descriptor: {
        subject_scope: "self",
        domain: "combat",
        relation: "appraises_capability_as",
        object_ref: "developing",
        qualifiers: [],
      },
      source_refs: [sourceRef(eliasInterpretation)],
    }],
  }),
  (error) => error?.code === "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_CURRENT_TURN_TRIGGER_REQUIRED",
);

assert.throws(
  () => buildWorldSimulationStructuredSelfModelAspects({
    world_state: {
      autobiographical_self_interpretation_events: {
        [eliasInterpretation.interpretation_event_id]: eliasInterpretation,
      },
      autobiographical_self_interpretation_history: [phase68ARef(eliasInterpretation)],
    },
    turn_id: turn1,
    aspect_decisions: [{
      character: elias,
      operation: "form",
      aspect_type: "value_orientation",
      aspect_key: "wrong_relation",
      descriptor: {
        subject_scope: "self",
        domain: "relationships",
        relation: "prefers",
        object_ref: "loyalty",
        qualifiers: [],
      },
      source_refs: [sourceRef(eliasInterpretation)],
    }],
  }),
  (error) => error?.code === "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_RELATION_INVALID",
);

assert.throws(
  () => buildWorldSimulationStructuredSelfModelAspects({
    world_state: {
      autobiographical_self_interpretation_events: {
        [eliasInterpretation.interpretation_event_id]: eliasInterpretation,
      },
      autobiographical_self_interpretation_history: [phase68ARef(eliasInterpretation)],
    },
    turn_id: turn1,
    aspect_decisions: [{
      character: elias,
      operation: "revise",
      aspect_type: "trait_tendency",
      aspect_key: "phase68c_not_yet",
      descriptor: {
        subject_scope: "self",
        domain: "conflict_response",
        relation: "tends_toward",
        object_ref: "avoidance",
        qualifiers: [],
      },
      source_refs: [sourceRef(eliasInterpretation)],
    }],
  }),
  (error) => error?.code === "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_OPERATION_UNSUPPORTED",
);

const replayA = projectWorldSimulationEffectiveStructuredSelfModel({ world_state: world });
const replayB = projectWorldSimulationEffectiveStructuredSelfModel({ world_state: clone(world) });
assert.equal(replayA.projection_hash, replayB.projection_hash);
assert.equal(Object.hasOwn(world, "self_model"), false);
assert.equal(Object.hasOwn(world, "personality_profile"), false);

console.log("Phase68B structured self model tests passed.");
