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
  buildWorldSimulationStructuredSelfModelResolverView,
} from "../../server/src/world-simulation-structured-self-model-service.mjs";
import {
  buildWorldSimulationStructuredSelfModelRevisionContract,
  buildWorldSimulationStructuredSelfModelRevisionResolverView,
  buildWorldSimulationStructuredSelfModelRevisions,
  projectWorldSimulationEffectiveRevisedStructuredSelfModel,
  projectWorldSimulationRevisedStructuredSelfModelForCharacter,
  worldSimulationStructuredSelfModelRevisionVersion,
} from "../../server/src/world-simulation-structured-self-model-revision-service.mjs";

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function interpretationEventHash(event) {
  const body = clone(event);
  delete body.interpretation_event_hash;
  return hashAgentRunValue(body);
}
function makeInterpretation({ character, turnId, kind, qualifier, previous = null }) {
  const event = {
    schema_version: autobiographicalSelfInterpretationEventSchemaVersion,
    version: worldSimulationAutobiographicalSelfInterpretationVersion,
    immutable: true,
    character,
    source_turn_id: turnId,
    operation: "establish",
    interpretation_id: `interpretation_${turnId}`,
    interpretation_kind: kind,
    source_refs: [{
      source_kind: "phase67b_life_event_organization",
      source_event_id: `life_event_${turnId}`,
      source_event_hash: `life_hash_${turnId}`,
    }],
    qualifiers: [qualifier],
    supersedes_interpretation_ids: [],
    resolver_view_hash: `resolver_${turnId}`,
    previous_interpretation_event_id: previous?.interpretation_event_id ?? null,
    previous_interpretation_event_hash: previous?.interpretation_event_hash ?? null,
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
  event.interpretation_event_hash = interpretationEventHash(event);
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
    previous_interpretation_event_id: event.previous_interpretation_event_id,
    previous_interpretation_event_hash: event.previous_interpretation_event_hash,
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
const turn1 = "world_turn_phase68c_001";
const interpretation1 = makeInterpretation({
  character: elias,
  turnId: turn1,
  kind: "continuity",
  qualifier: "repeated_pattern",
});
let world = {
  autobiographical_self_interpretation_events: {
    [interpretation1.interpretation_event_id]: interpretation1,
  },
  autobiographical_self_interpretation_history: [interpretationRef(interpretation1)],
};

const formationResolver = buildWorldSimulationStructuredSelfModelResolverView({
  world_state: world,
  turn_id: turn1,
});
const formed = buildWorldSimulationStructuredSelfModelAspects({
  world_state: world,
  turn_id: turn1,
  aspect_decisions: [{
    character: elias,
    operation: "form",
    aspect_type: "capability_appraisal",
    aspect_key: "combat_capability",
    descriptor: {
      subject_scope: "self",
      domain: "combat",
      relation: "appraises_capability_as",
      object_ref: "inadequate",
      qualifiers: ["context_sensitive"],
    },
    source_refs: [interpretationSource(interpretation1)],
    resolver_view_hash: formationResolver.resolver_view_hash,
  }],
});
world = executeBuilt(world, turn1, "structured_self_model", formed);
const baseAspect = formed.result.aspect_events_created[0];

const contract = buildWorldSimulationStructuredSelfModelRevisionContract();
assert.equal(contract.phase, "Phase68C");
assert.deepEqual(contract.supported_operations, ["support", "challenge", "revise"]);
assert.equal(contract.support_preserves_active_state, true);
assert.equal(contract.challenge_preserves_active_state, true);
assert.equal(contract.revise_explicitly_supersedes_targets, true);
assert.equal(contract.last_write_wins_allowed, false);
assert.equal(contract.motivation_goal_selection_modeled, false);

const turn2 = "world_turn_phase68c_002";
const interpretation2 = makeInterpretation({
  character: elias,
  turnId: turn2,
  kind: "change",
  qualifier: "counterexample",
  previous: interpretation1,
});
world = clone(world);
world.autobiographical_self_interpretation_events[interpretation2.interpretation_event_id] = interpretation2;
world.autobiographical_self_interpretation_history.push(interpretationRef(interpretation2));

const challengeResolver = buildWorldSimulationStructuredSelfModelRevisionResolverView({
  world_state: world,
  turn_id: turn2,
});
assert.equal(challengeResolver.current_turn_trigger_refs.length, 1);
assert.equal(challengeResolver.raw_world_state_exposed, false);
assert.equal(challengeResolver.phase67_store_exposed, false);
const challenge = buildWorldSimulationStructuredSelfModelRevisions({
  world_state: world,
  turn_id: turn2,
  revision_decisions: [{
    character: elias,
    operation: "challenge",
    target_aspect_ids: [baseAspect.aspect_id],
    source_refs: [interpretationSource(interpretation2)],
    resolver_view_hash: challengeResolver.resolver_view_hash,
  }],
});
assert.equal(challenge.version, worldSimulationStructuredSelfModelRevisionVersion);
assert.equal(challenge.result.revision_events_created.length, 1);
assert.equal(challenge.result.revision_events_created[0].replacement_aspect_id, null);
assert.equal(challenge.result.revision_events_created[0].self_model_revision, true);
assert.equal(challenge.result.revision_events_created[0].world_truth_verified, false);
assert.equal(challenge.result.revision_events_created[0].confidence, null);
assert.equal(challenge.result.revision_events_created[0].probability, null);
world = executeBuilt(world, turn2, "structured_self_model_revision", challenge);

let projection = projectWorldSimulationEffectiveRevisedStructuredSelfModel({ world_state: world });
let record = projection.aspects_by_character[elias][baseAspect.aspect_id];
assert.equal(record.state, "active");
assert.equal(record.challenge_event_ids.length, 1);
assert.equal(record.support_event_ids.length, 0);
assert.equal(projection.last_write_wins_applied, false);
assert.equal(projection.forced_global_coherence_applied, false);
assert.equal(projection.neighboring_aspect_propagation_applied, false);

assert.throws(
  () => buildWorldSimulationStructuredSelfModelRevisions({
    world_state: world,
    turn_id: turn2,
    revision_decisions: [{
      character: elias,
      operation: "support",
      target_aspect_ids: [baseAspect.aspect_id],
      source_refs: [interpretationSource(interpretation2)],
    }],
  }),
  (error) => error?.code === "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_REVISION_PER_CHARACTER_TURN_LIMIT",
);

const turn3 = "world_turn_phase68c_003";
const interpretation3 = makeInterpretation({
  character: elias,
  turnId: turn3,
  kind: "change",
  qualifier: "developmental_shift",
  previous: interpretation2,
});
world = clone(world);
world.autobiographical_self_interpretation_events[interpretation3.interpretation_event_id] = interpretation3;
world.autobiographical_self_interpretation_history.push(interpretationRef(interpretation3));
const reviseResolver = buildWorldSimulationStructuredSelfModelRevisionResolverView({
  world_state: world,
  turn_id: turn3,
});
const revised = buildWorldSimulationStructuredSelfModelRevisions({
  world_state: world,
  turn_id: turn3,
  revision_decisions: [{
    character: elias,
    operation: "revise",
    target_aspect_ids: [baseAspect.aspect_id],
    source_refs: [interpretationSource(interpretation3)],
    replacement_aspect_type: "capability_appraisal",
    replacement_aspect_key: "combat_capability_developing",
    replacement_descriptor: {
      subject_scope: "self",
      domain: "combat",
      relation: "appraises_capability_as",
      object_ref: "developing",
      qualifiers: ["experience_dependent"],
    },
    resolver_view_hash: reviseResolver.resolver_view_hash,
  }],
});
const reviseEvent = revised.result.revision_events_created[0];
assert.ok(reviseEvent.replacement_aspect_id);
assert.notEqual(reviseEvent.replacement_aspect_id, baseAspect.aspect_id);
world = executeBuilt(world, turn3, "structured_self_model_revision", revised);

projection = projectWorldSimulationEffectiveRevisedStructuredSelfModel({ world_state: world });
record = projection.aspects_by_character[elias][baseAspect.aspect_id];
assert.equal(record.state, "superseded");
assert.equal(record.replacement_aspect_id, reviseEvent.replacement_aspect_id);
const replacement = projection.aspects_by_character[elias][reviseEvent.replacement_aspect_id];
assert.equal(replacement.state, "active");
assert.equal(replacement.descriptor.object_ref, "developing");

assert.throws(
  () => projectWorldSimulationRevisedStructuredSelfModelForCharacter({
    world_state: world,
    character: elias,
    current_turn_id: turn3,
  }),
  (error) => error?.code === "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_REVISION_SAME_TURN_CONTAMINATION",
);
const characterProjection = projectWorldSimulationRevisedStructuredSelfModelForCharacter({
  world_state: world,
  character: elias,
  current_turn_id: "world_turn_phase68c_004",
});
assert.equal(characterProjection.character_view.aspects.length, 1);
assert.equal(characterProjection.character_view.aspects[0].object, "developing");
assert.equal(characterProjection.character_view.aspects[0].revision_state, "active");
assert.equal(characterProjection.audit.aspect_ids_exposed, false);
assert.equal(characterProjection.audit.revision_event_ids_exposed, false);
assert.equal(characterProjection.audit.source_ids_hashes_exposed, false);
assert.equal(characterProjection.audit.motivation_goal_authority_exposed, false);

assert.throws(
  () => buildWorldSimulationStructuredSelfModelRevisions({
    world_state: world,
    turn_id: "world_turn_phase68c_004",
    revision_decisions: [{
      character: elias,
      operation: "challenge",
      target_aspect_ids: [baseAspect.aspect_id],
      source_refs: [interpretationSource(interpretation3)],
    }],
  }),
  (error) => [
    "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_REVISION_TARGET_INVALID",
    "WORLD_SIMULATION_STRUCTURED_SELF_MODEL_REVISION_CURRENT_TURN_TRIGGER_REQUIRED",
  ].includes(error?.code),
);

const replayA = projectWorldSimulationEffectiveRevisedStructuredSelfModel({ world_state: world });
const replayB = projectWorldSimulationEffectiveRevisedStructuredSelfModel({ world_state: clone(world) });
assert.equal(replayA.projection_hash, replayB.projection_hash);
assert.equal(Object.hasOwn(world, "self_model"), false);
assert.equal(Object.hasOwn(world, "personality_profile"), false);

console.log("Phase68C structured self-model revision tests passed.");
