import assert from "node:assert/strict";

import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import {
  buildWorldSimulationChronologicalMutationQueue,
  executeWorldSimulationChronologicalMutationQueue,
} from "../../server/src/world-simulation-chronological-mutation-queue-service.mjs";
import {
  buildWorldSimulationSubjectiveEpisodeSegmentations,
} from "../../server/src/world-simulation-subjective-episode-segmentation-service.mjs";
import {
  buildWorldSimulationAutobiographicalLifeEventOrganizations,
} from "../../server/src/world-simulation-autobiographical-life-event-service.mjs";
import {
  autobiographicalSelfInterpretationCharacterProjectionVersion,
  buildWorldSimulationAutobiographicalSelfInterpretationContract,
  buildWorldSimulationAutobiographicalSelfInterpretationResolverView,
  buildWorldSimulationAutobiographicalSelfInterpretations,
  projectWorldSimulationAutobiographicalSelfInterpretationsForCharacter,
  projectWorldSimulationEffectiveAutobiographicalSelfInterpretations,
  worldSimulationAutobiographicalSelfInterpretationVersion,
} from "../../server/src/world-simulation-autobiographical-self-interpretation-service.mjs";
import {
  buildWorldSimulationLoopContract,
} from "../../server/src/world-simulation-loop-service.mjs";
import {
  buildWorldSimulationCharacterBrainInput,
} from "../../server/src/world-simulation-character-brain-input-service.mjs";

const elias = "伊萊亞斯・諾爾";
const rio = "柊木璃央";

function memoryFixture({ memoryId, turnId, sceneId, description }) {
  return {
    memory_id: memoryId,
    memory_type: "episodic_direct_perception",
    content: { kind: "visual_observation", description },
    source: { kind: "direct_perception", sense: "visual" },
    internal_provenance: {
      event_id: `engine_event_${memoryId}`,
      scene_id: sceneId,
      turn_id: turnId,
      observation_hash: `observation_${memoryId}`,
      formation_version: "phase63a-subjective-memory-formation-v2",
    },
    retrieval_cues: {
      scene_id: sceneId,
      sense: "visual",
      observation_kind: "visual_observation",
      memory_type: "episodic_direct_perception",
    },
    formation_stage: "encoded_unconsolidated",
    engine_persisted_trace: true,
    last_recalled_at: null,
    accessible: true,
    suppressed: false,
    possibly_incorrect: false,
    source_confused: false,
    subjective_memory_not_world_truth: true,
    encoded_at: `${turnId}:encoded`,
  };
}

function source(character, memory) {
  return { character, memory_record: structuredClone(memory) };
}

function executeTransitions(worldState, turnId, suffix, built) {
  const queue = buildWorldSimulationChronologicalMutationQueue({
    turn_id: `${turnId}:${suffix}`,
    world_state_hash: hashAgentRunValue(worldState),
    state_transitions: built.result.state_transitions,
    elapsed_ms: 0,
  });
  const execution = executeWorldSimulationChronologicalMutationQueue({
    world_state: worldState,
    preview_world_state: built.result.preview_world_state,
    queue,
  });
  return execution.next_world_state;
}

function executeLifeEventTurn(worldState, turnId, character, memory) {
  const segmented = buildWorldSimulationSubjectiveEpisodeSegmentations({
    world_state: worldState,
    turn_id: turnId,
    source_memory_records: [source(character, memory)],
  });
  const segmentationWorld = executeTransitions(
    worldState,
    turnId,
    "subjective_episode_segmentation",
    segmented,
  );
  const segmentationIds = [
    ...segmented.result.segmentation_events_created.map((item) => item.segmentation_event_id),
    ...segmented.result.already_persisted_segmentation_event_ids,
  ];
  const life = buildWorldSimulationAutobiographicalLifeEventOrganizations({
    world_state: segmentationWorld,
    turn_id: turnId,
    source_segmentation_event_ids: segmentationIds,
    organization_decisions: [],
  });
  const lifeWorld = executeTransitions(
    segmentationWorld,
    turnId,
    "autobiographical_life_event",
    life,
  );
  return {
    world_state: lifeWorld,
    organization_events: life.result.organization_events_created,
  };
}

function phase67bSourceRef(event) {
  return {
    source_kind: "phase67b_life_event_organization",
    source_event_id: event.organization_event_id,
    source_event_hash: event.organization_event_hash,
  };
}

function executeInterpretation(worldState, turnId, decisions) {
  const built = buildWorldSimulationAutobiographicalSelfInterpretations({
    world_state: worldState,
    turn_id: turnId,
    interpretation_decisions: decisions,
  });
  return {
    built,
    world_state: executeTransitions(
      worldState,
      turnId,
      "autobiographical_self_interpretation",
      built,
    ),
  };
}

const contract = buildWorldSimulationAutobiographicalSelfInterpretationContract();
assert.equal(contract.phase, "Phase68A");
assert.equal(contract.version, worldSimulationAutobiographicalSelfInterpretationVersion);
assert.equal(
  contract.character_projection_version,
  autobiographicalSelfInterpretationCharacterProjectionVersion,
);
assert.deepEqual(contract.source_owners, ["Phase67B", "Phase67C", "Phase67D"]);
assert.deepEqual(contract.supported_operations, ["establish", "supersede"]);
assert.deepEqual(contract.supported_interpretation_kinds, [
  "continuity",
  "change",
  "causal_connection",
  "thematic_recurrence",
  "contrast",
]);
assert.equal(contract.immutable_interpretation_event_write_once_required, true);
assert.equal(contract.append_only_history_required, true);
assert.equal(contract.explicit_supersession_only, true);
assert.equal(contract.multiple_active_interpretations_allowed, true);
assert.equal(contract.max_one_interpretation_event_per_character_per_turn, true);
assert.equal(contract.last_write_wins_allowed, false);
assert.equal(contract.mandatory_narrative_coherence_required, false);
assert.equal(contract.world_truth_authority_claimed, false);
assert.equal(contract.belief_engine_duplicated, false);
assert.equal(contract.self_model_modeled, false);
assert.equal(contract.stable_traits_modeled, false);
assert.equal(contract.values_modeled, false);
assert.equal(contract.preferences_modeled, false);
assert.equal(contract.role_identity_modeled, false);
assert.equal(contract.capability_self_rating_modeled, false);
assert.equal(contract.motivation_goal_integration_modeled, false);
assert.equal(contract.confidence_probability_modeled, false);
assert.equal(contract.importance_salience_truth_ranking_modeled, false);
assert.equal(contract.freeform_llm_life_story_authority, false);
assert.equal(contract.separate_retrieval_engine_installed, false);
assert.equal(contract.hidden_semantic_graph_allowed, false);
assert.equal(contract.character_brain_direct_durable_write_allowed, false);
assert.equal(contract.authoritative_mutation_owner, "phase62k-authoritative-mutation-executor-v1");
assert.equal(contract.committed_prior_turn_character_projection_only, true);
assert.equal(contract.same_turn_character_brain_feedback_allowed, false);
assert.equal(contract.same_turn_contamination_policy, "fail_closed");

const loopContract = buildWorldSimulationLoopContract();
assert.equal(loopContract.autobiographical_self_interpretation.phase, "Phase68A");
assert.equal(
  loopContract.autobiographical_self_interpretation_resolver_hook.option_name,
  "autobiographicalSelfInterpretationResolver",
);
assert.deepEqual(
  loopContract.autobiographical_self_interpretation_resolver_hook.may_request_operations,
  ["establish", "supersede"],
);
assert.equal(
  loopContract.autobiographical_self_interpretation_resolver_hook.freeform_life_story_authority,
  false,
);
assert.equal(
  loopContract.autobiographical_self_interpretation_resolver_hook.self_model_inference_allowed,
  false,
);

const emptyWorld = {};
const emptyHash = hashAgentRunValue(emptyWorld);
const emptyProjection = projectWorldSimulationEffectiveAutobiographicalSelfInterpretations({
  world_state: emptyWorld,
});
assert.deepEqual(emptyProjection.interpretations_by_character, {});
assert.deepEqual(emptyProjection.active_interpretation_ids_by_character, {});
assert.equal(emptyProjection.replayable_projection, true);
assert.equal(emptyProjection.last_write_wins_applied, false);
assert.equal(hashAgentRunValue(emptyWorld), emptyHash);
const emptyCharacterView =
  projectWorldSimulationAutobiographicalSelfInterpretationsForCharacter({
    world_state: emptyWorld,
    character: elias,
    current_turn_id: "world_turn_phase68a_empty",
  });
assert.deepEqual(emptyCharacterView.character_view.interpretations, []);
assert.equal(emptyCharacterView.character_view.narrative_story_generated, false);
assert.equal(emptyCharacterView.character_view.trait_model_exposed, false);
assert.equal(emptyCharacterView.character_view.motivation_goal_model_exposed, false);

const turn1 = "world_turn_phase68a_001";
const memory1 = memoryFixture({
  memoryId: "memory_phase68a_elias_001",
  turnId: turn1,
  sceneId: "academy_first_day",
  description: "Elias remembers arriving at the academy; this raw episodic content must not become a Phase68A life story.",
});
let world = { memories: { [elias]: [memory1] } };
const life1 = executeLifeEventTurn(world, turn1, elias, memory1);
world = life1.world_state;
assert.equal(life1.organization_events.length, 1);
const lifeEvent1 = life1.organization_events[0];

const resolverView1 = buildWorldSimulationAutobiographicalSelfInterpretationResolverView({
  world_state: world,
  turn_id: turn1,
});
assert.equal(resolverView1.current_turn_trigger_refs.length, 1);
assert.equal(resolverView1.current_turn_trigger_refs[0].character, elias);
assert.equal(resolverView1.raw_world_state_exposed, false);
assert.equal(resolverView1.memory_content_exposed, false);
assert.equal(resolverView1.freeform_life_story_requested, false);
assert.equal(resolverView1.trait_inference_requested, false);
assert.equal(resolverView1.motivation_goal_inference_requested, false);

const established = executeInterpretation(world, turn1, [{
  character: elias,
  operation: "establish",
  interpretation_kind: "change",
  source_refs: [phase67bSourceRef(lifeEvent1)],
  qualifiers: ["turning_point"],
  resolver_view_hash: resolverView1.resolver_view_hash,
}]);
world = established.world_state;
assert.equal(established.built.result.interpretation_events_created.length, 1);
const interpretation1 = established.built.result.interpretation_events_created[0];
assert.equal(interpretation1.operation, "establish");
assert.equal(interpretation1.interpretation_kind, "change");
assert.equal(interpretation1.subjective_not_world_truth, true);
assert.equal(interpretation1.epistemic_belief, false);
assert.equal(interpretation1.self_model, false);
assert.equal(interpretation1.trait_model, false);
assert.equal(interpretation1.motivation_goal_model, false);
assert.equal(interpretation1.confidence, null);
assert.equal(interpretation1.probability, null);
assert.equal(interpretation1.freeform_life_story_authority, false);

const effective1 = projectWorldSimulationEffectiveAutobiographicalSelfInterpretations({
  world_state: world,
});
assert.equal(effective1.active_interpretation_ids_by_character[elias].length, 1);
assert.equal(
  effective1.interpretations_by_character[elias][interpretation1.interpretation_id].state,
  "active",
);

assert.throws(
  () => projectWorldSimulationAutobiographicalSelfInterpretationsForCharacter({
    world_state: world,
    character: elias,
    current_turn_id: turn1,
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_AUTOBIOGRAPHICAL_SELF_INTERPRETATION_SAME_TURN_CONTAMINATION",
);

const priorView1 = projectWorldSimulationAutobiographicalSelfInterpretationsForCharacter({
  world_state: world,
  character: elias,
  current_turn_id: "world_turn_phase68a_002",
});
assert.equal(
  priorView1.version,
  autobiographicalSelfInterpretationCharacterProjectionVersion,
);
assert.equal(priorView1.character_view.interpretations.length, 1);
assert.deepEqual(priorView1.character_view.interpretations[0].qualifiers, ["turning_point"]);
assert.equal(priorView1.character_view.interpretations[0].interpretation_kind, "change");
assert.equal(priorView1.character_view.interpretations[0].subjective_not_world_truth, true);
assert.equal(priorView1.character_view.interpretations[0].epistemic_belief, false);
assert.equal(priorView1.character_view.interpretations[0].self_model, false);
assert.equal(priorView1.audit.source_ids_exposed_to_character_brain, false);
assert.equal(priorView1.audit.source_hashes_exposed_to_character_brain, false);
assert.equal(priorView1.audit.source_turn_ids_exposed_to_character_brain, false);
assert.equal(priorView1.audit.freeform_life_story_generated, false);
assert.equal(
  JSON.stringify(priorView1.character_view).includes(memory1.content.description),
  false,
);
for (const forbidden of [
  "interpretation_id",
  "interpretation_event_id",
  "organization_event_id",
  "derivation_event_id",
  "projection_hash",
  "source_turn_id",
]) {
  assert.equal(
    JSON.stringify(priorView1.character_view).includes(forbidden),
    false,
    forbidden,
  );
}

const brainInput = buildWorldSimulationCharacterBrainInput({
  character: elias,
  perception: {},
  retrieval_experience: {
    process_occurred: false,
    initiation_mode: null,
    target_outcome: null,
    recovered_any_content: false,
  },
  cognition: {
    working_context: {
      focus: null,
      active_context: [],
      peripheral_context: [],
      fading_context: [],
      suspended_context: [],
    },
    self_interpretation_context: priorView1.character_view,
  },
  candidate_action_intents: [],
  boundaries: {
    recollection_reinstatement_v3_installed: true,
    selective_working_memory_output_gating_v5_installed: true,
    autobiographical_self_interpretation_projection_installed: true,
  },
});
assert.deepEqual(
  brainInput.cognition.self_interpretation_context,
  priorView1.character_view,
  "Character Brain ingress must preserve only the bounded prior-turn Phase68A projection",
);

const turn2 = "world_turn_phase68a_002";
const memory2 = memoryFixture({
  memoryId: "memory_phase68a_elias_002",
  turnId: turn2,
  sceneId: "academy_second_experience",
  description: "A later autobiographical event gives Elias new evidence for reinterpretation.",
});
world = structuredClone(world);
world.memories[elias].push(memory2);
const life2 = executeLifeEventTurn(world, turn2, elias, memory2);
world = life2.world_state;
const lifeEvent2 = life2.organization_events[0];
const resolverView2 = buildWorldSimulationAutobiographicalSelfInterpretationResolverView({
  world_state: world,
  turn_id: turn2,
});
const superseded = executeInterpretation(world, turn2, [{
  character: elias,
  operation: "supersede",
  interpretation_kind: "continuity",
  source_refs: [
    phase67bSourceRef(lifeEvent1),
    phase67bSourceRef(lifeEvent2),
  ],
  qualifiers: ["before_after"],
  supersedes_interpretation_ids: [interpretation1.interpretation_id],
  resolver_view_hash: resolverView2.resolver_view_hash,
}]);
world = superseded.world_state;
const interpretation2 = superseded.built.result.interpretation_events_created[0];
const effective2 = projectWorldSimulationEffectiveAutobiographicalSelfInterpretations({
  world_state: world,
});
assert.equal(
  effective2.interpretations_by_character[elias][interpretation1.interpretation_id].state,
  "superseded",
);
assert.equal(
  effective2.interpretations_by_character[elias][interpretation2.interpretation_id].state,
  "active",
);
assert.deepEqual(
  effective2.active_interpretation_ids_by_character[elias],
  [interpretation2.interpretation_id],
);

const turn3 = "world_turn_phase68a_003";
const memory3 = memoryFixture({
  memoryId: "memory_phase68a_elias_003",
  turnId: turn3,
  sceneId: "academy_third_experience",
  description: "A third event can support another interpretation without replacing the current one.",
});
world = structuredClone(world);
world.memories[elias].push(memory3);
const life3 = executeLifeEventTurn(world, turn3, elias, memory3);
world = life3.world_state;
const lifeEvent3 = life3.organization_events[0];
const resolverView3 = buildWorldSimulationAutobiographicalSelfInterpretationResolverView({
  world_state: world,
  turn_id: turn3,
});
const coexisting = executeInterpretation(world, turn3, [{
  character: elias,
  operation: "establish",
  interpretation_kind: "contrast",
  source_refs: [phase67bSourceRef(lifeEvent3)],
  qualifiers: ["counterpattern"],
  resolver_view_hash: resolverView3.resolver_view_hash,
}]);
world = coexisting.world_state;
const interpretation3 = coexisting.built.result.interpretation_events_created[0];
const effective3 = projectWorldSimulationEffectiveAutobiographicalSelfInterpretations({
  world_state: world,
});
assert.deepEqual(
  new Set(effective3.active_interpretation_ids_by_character[elias]),
  new Set([interpretation2.interpretation_id, interpretation3.interpretation_id]),
);
assert.equal(effective3.multiple_active_interpretations_allowed, true);
assert.equal(effective3.mandatory_narrative_coherence_applied, false);
assert.equal(effective3.last_write_wins_applied, false);

const resolverView3AfterCommit =
  buildWorldSimulationAutobiographicalSelfInterpretationResolverView({
    world_state: world,
    turn_id: turn3,
  });

assert.throws(
  () => buildWorldSimulationAutobiographicalSelfInterpretations({
    world_state: world,
    turn_id: turn3,
    interpretation_decisions: [{
      character: elias,
      operation: "establish",
      interpretation_kind: "change",
      source_refs: [phase67bSourceRef(lifeEvent3)],
      qualifiers: ["turning_point"],
      resolver_view_hash: resolverView3AfterCommit.resolver_view_hash,
    }, {
      character: elias,
      operation: "establish",
      interpretation_kind: "continuity",
      source_refs: [phase67bSourceRef(lifeEvent3)],
      qualifiers: ["within_period"],
      resolver_view_hash: resolverView3AfterCommit.resolver_view_hash,
    }],
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_AUTOBIOGRAPHICAL_SELF_INTERPRETATION_PER_CHARACTER_TURN_LIMIT",
);

const turnRio = "world_turn_phase68a_rio_001";
const rioMemory = memoryFixture({
  memoryId: "memory_phase68a_rio_001",
  turnId: turnRio,
  sceneId: "rio_scene",
  description: "Rio's autobiographical evidence must remain isolated from Elias.",
});
let crossWorld = structuredClone(world);
crossWorld.memories ??= {};
crossWorld.memories[rio] = [rioMemory];
const rioLife = executeLifeEventTurn(crossWorld, turnRio, rio, rioMemory);
crossWorld = rioLife.world_state;
const rioSource = phase67bSourceRef(rioLife.organization_events[0]);
const rioResolver = buildWorldSimulationAutobiographicalSelfInterpretationResolverView({
  world_state: crossWorld,
  turn_id: turnRio,
});
assert.throws(
  () => buildWorldSimulationAutobiographicalSelfInterpretations({
    world_state: crossWorld,
    turn_id: turnRio,
    interpretation_decisions: [{
      character: elias,
      operation: "establish",
      interpretation_kind: "contrast",
      source_refs: [rioSource],
      qualifiers: ["counterpattern"],
      resolver_view_hash: rioResolver.resolver_view_hash,
    }],
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_AUTOBIOGRAPHICAL_SELF_INTERPRETATION_CROSS_CHARACTER_SOURCE_FORBIDDEN",
);

assert.throws(
  () => buildWorldSimulationAutobiographicalSelfInterpretations({
    world_state: world,
    turn_id: "world_turn_phase68a_no_current_trigger",
    interpretation_decisions: [{
      character: elias,
      operation: "establish",
      interpretation_kind: "thematic_recurrence",
      source_refs: [phase67bSourceRef(lifeEvent1)],
      qualifiers: ["repeated_pattern"],
    }],
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_AUTOBIOGRAPHICAL_SELF_INTERPRETATION_CURRENT_TURN_TRIGGER_REQUIRED",
);

const replayA = projectWorldSimulationEffectiveAutobiographicalSelfInterpretations({
  world_state: world,
});
const replayB = projectWorldSimulationEffectiveAutobiographicalSelfInterpretations({
  world_state: structuredClone(world),
});
assert.equal(replayA.projection_hash, replayB.projection_hash);
assert.equal(
  Object.hasOwn(world, "self_model"),
  false,
);
assert.equal(
  Object.hasOwn(world, "self_narrative"),
  false,
);

console.log("Phase68A autobiographical self-interpretation foundation tests passed.");
