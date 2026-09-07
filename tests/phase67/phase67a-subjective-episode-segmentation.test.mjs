import assert from "node:assert/strict";

import {
  hashAgentRunValue,
} from "../../server/src/agent-run-service.mjs";
import {
  buildWorldSimulationChronologicalMutationQueue,
  buildWorldSimulationChronologicalMutationQueueContract,
  executeWorldSimulationChronologicalMutationQueue,
} from "../../server/src/world-simulation-chronological-mutation-queue-service.mjs";
import {
  buildWorldSimulationSubjectiveEpisodeSegmentationContract,
  buildWorldSimulationSubjectiveEpisodeSegmentations,
  effectiveSubjectiveEpisodeProjectionVersion,
  projectWorldSimulationEffectiveSubjectiveEpisodes,
  subjectiveEpisodeSegmentationEventSchemaVersion,
  subjectiveEpisodeSegmentationHistoryReferenceSchemaVersion,
  worldSimulationSubjectiveEpisodeSegmentationVersion,
} from "../../server/src/world-simulation-subjective-episode-segmentation-service.mjs";

const elias = "伊萊亞斯・諾爾";
const rion = "柊木璃央";

function memoryFixture({
  memoryId,
  turnId,
  sceneId,
  sense = "visual",
  description,
  explicitEpisodeId = null,
}) {
  const record = {
    memory_id: memoryId,
    memory_type: "episodic_direct_perception",
    content: {
      kind: `${sense}_observation`,
      description,
    },
    source: {
      kind: "direct_perception",
      sense,
    },
    internal_provenance: {
      event_id: `engine_event_${memoryId}`,
      scene_id: sceneId,
      turn_id: turnId,
      observation_hash: `observation_${memoryId}`,
      formation_version: "phase63a-subjective-memory-formation-v2",
    },
    retrieval_cues: {
      scene_id: sceneId,
      sense,
      observation_kind: `${sense}_observation`,
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

  if (explicitEpisodeId) {
    record.episodic_binding = {
      subjective_episode_id: explicitEpisodeId,
    };
    record.retrieval_cues.subjective_episode_id = explicitEpisodeId;
  }

  return record;
}

function source(character, memory) {
  return {
    character,
    memory_record: structuredClone(memory),
  };
}

function executeSegmentation(worldState, turnId, sourceMemories) {
  const projection = buildWorldSimulationSubjectiveEpisodeSegmentations({
    world_state: worldState,
    turn_id: turnId,
    source_memory_records: sourceMemories,
  });
  const queue = buildWorldSimulationChronologicalMutationQueue({
    turn_id: `${turnId}:subjective_episode_segmentation`,
    world_state_hash: hashAgentRunValue(worldState),
    state_transitions: projection.result.state_transitions,
    elapsed_ms: 0,
  });
  const execution = executeWorldSimulationChronologicalMutationQueue({
    world_state: worldState,
    preview_world_state: projection.result.preview_world_state,
    queue,
  });
  return {
    projection,
    queue,
    execution,
    world_state: execution.next_world_state,
  };
}

const contract = buildWorldSimulationSubjectiveEpisodeSegmentationContract();
assert.equal(contract.version, worldSimulationSubjectiveEpisodeSegmentationVersion);
assert.equal(contract.phase, "Phase67A");
assert.equal(contract.status, "automatic_subjective_episode_segmentation_installed");
assert.equal(contract.source_memory_owner, "Phase63A");
assert.equal(contract.explicit_episode_binding_owner, "Phase63A");
assert.equal(contract.immutable_segmentation_event_write_once_required, true);
assert.equal(contract.append_only_history_required, true);
assert.equal(contract.per_character_previous_event_hash_chain_required, true);
assert.equal(contract.effective_episode_projection_replayable, true);
assert.equal(
  contract.effective_episode_projection_version,
  effectiveSubjectiveEpisodeProjectionVersion,
);
assert.equal(contract.phase63_memory_content_rewritten, false);
assert.equal(contract.phase63_memory_content_copied_into_episode_nodes, false);
assert.equal(contract.world_event_id_auto_promoted_to_subjective_episode_id, false);
assert.equal(contract.world_turn_id_auto_promoted_to_subjective_episode_id, false);
assert.equal(contract.scene_id_auto_promoted_to_subjective_episode_id, false);
assert.equal(contract.scene_change_is_universal_psychological_boundary, false);
assert.equal(contract.numeric_prediction_error_threshold_modeled, false);
assert.equal(contract.explicit_phase63_episode_binding_preserved, true);
assert.equal(contract.hidden_world_state_allowed, false);
assert.equal(contract.world_truth_authority_claimed, false);
assert.equal(contract.confidence_probability_modeled, false);
assert.equal(contract.last_write_wins_allowed, false);
assert.equal(contract.character_brain_direct_durable_write_allowed, false);
assert.equal(contract.same_turn_character_brain_feedback_allowed, false);
assert.equal(contract.separate_retrieval_engine_installed, false);
assert.equal(contract.phase63_phase64_retrieval_substrate_reused, true);
assert.equal(
  contract.authoritative_mutation_owner,
  "phase62k-authoritative-mutation-executor-v1",
);

const mutationContract = buildWorldSimulationChronologicalMutationQueueContract();
for (const key of [
  "phase67a_subjective_episode_segmentation_event_write_once_enforced",
  "phase67a_subjective_episode_segmentation_event_content_address_verified",
  "phase67a_source_subjective_memory_hash_pinning_enforced",
  "phase67a_explicit_phase63_episode_binding_preserved",
  "phase67a_subjective_episode_segmentation_history_append_only_enforced",
  "phase67a_per_character_segmentation_hash_chain_enforced",
]) {
  assert.equal(mutationContract.execution[key], true, key);
}

const turn1 = "world_turn_phase67a_001";
const eliasVisual1 = memoryFixture({
  memoryId: "memory_phase67a_elias_visual_1",
  turnId: turn1,
  sceneId: "training_room_a",
  description: "看見阿灰伏低身體。",
});
const eliasAudio1 = memoryFixture({
  memoryId: "memory_phase67a_elias_audio_1",
  turnId: turn1,
  sceneId: "training_room_a",
  sense: "auditory",
  description: "聽見甲片摩擦地面的聲音。",
});

const baseWorld = {
  simulation_time: "2026-09-07T16:00:00+08:00",
  memories: {
    [elias]: [eliasVisual1, eliasAudio1],
  },
};
const baseSnapshot = structuredClone(baseWorld);
const first = executeSegmentation(
  baseWorld,
  turn1,
  [source(elias, eliasVisual1), source(elias, eliasAudio1)],
);
assert.deepEqual(baseWorld, baseSnapshot);
assert.equal(first.projection.ok, true);
assert.equal(first.projection.result.processed_source_memory_count, 2);
assert.equal(first.projection.result.new_source_memory_count, 2);
assert.equal(first.projection.result.segmentation_events_created.length, 1);
assert.equal(first.projection.result.history_references_appended.length, 1);
assert.equal(first.queue.mutation_count, 2);
assert.equal(first.execution.execution.sole_final_world_state_writer, true);

const firstEvent = first.projection.result.segmentation_events_created[0];
assert.equal(firstEvent.schema_version, subjectiveEpisodeSegmentationEventSchemaVersion);
assert.equal(firstEvent.immutable, true);
assert.equal(firstEvent.resolution, "start_new_episode");
assert.equal(firstEvent.character, elias);
assert.equal(firstEvent.source_turn_id, turn1);
assert.equal(firstEvent.subjective_not_world_truth, true);
assert.equal(firstEvent.world_truth_verified, false);
assert.equal(firstEvent.confidence, null);
assert.equal(firstEvent.probability, null);
assert.equal(firstEvent.memory_content_copied, false);
assert.equal(firstEvent.world_event_identity_promoted, false);
assert.equal(firstEvent.world_turn_identity_promoted, false);
assert.equal(firstEvent.scene_identity_promoted, false);
assert.equal(firstEvent.character_brain_direct_write, false);
assert.deepEqual(
  firstEvent.source_memory_refs.map((item) => item.memory_id),
  [eliasAudio1.memory_id, eliasVisual1.memory_id].sort(),
);
assert.equal(Object.hasOwn(firstEvent, "content"), false);
assert.equal(JSON.stringify(firstEvent).includes("看見阿灰伏低身體"), false);
const firstEventBody = structuredClone(firstEvent);
delete firstEventBody.segmentation_event_hash;
assert.equal(firstEvent.segmentation_event_hash, hashAgentRunValue(firstEventBody));
assert.notEqual(firstEvent.subjective_episode_id, turn1);
assert.notEqual(firstEvent.subjective_episode_id, "training_room_a");
assert.notEqual(firstEvent.subjective_episode_id, eliasVisual1.internal_provenance.event_id);

const firstHistory = first.world_state.subjective_episode_segmentation_history[0];
assert.equal(
  firstHistory.schema_version,
  subjectiveEpisodeSegmentationHistoryReferenceSchemaVersion,
);
assert.equal(firstHistory.derived_index, true);
assert.equal(firstHistory.segmentation_event_id, firstEvent.segmentation_event_id);
assert.equal(firstHistory.segmentation_event_hash, firstEvent.segmentation_event_hash);

const firstEpisodeProjection = projectWorldSimulationEffectiveSubjectiveEpisodes({
  world_state: first.world_state,
});
assert.equal(firstEpisodeProjection.replayable_projection, true);
assert.equal(firstEpisodeProjection.memory_content_duplicated, false);
assert.equal(firstEpisodeProjection.world_truth_authority_claimed, false);
assert.equal(firstEpisodeProjection.character_brain_exposure_installed, false);
assert.deepEqual(
  firstEpisodeProjection
    .episodes_by_character[elias][firstEvent.subjective_episode_id]
    .source_memory_ids,
  [eliasAudio1.memory_id, eliasVisual1.memory_id].sort(),
);

const turn2 = "world_turn_phase67a_002";
const eliasVisual2 = memoryFixture({
  memoryId: "memory_phase67a_elias_visual_2",
  turnId: turn2,
  sceneId: "training_room_a",
  description: "稍後仍看見阿灰停在同一間實習室。",
});
const turn2World = structuredClone(first.world_state);
turn2World.memories[elias].push(eliasVisual2);
const priorMemoriesBeforeTurn2 = structuredClone(turn2World.memories[elias]);
const second = executeSegmentation(
  turn2World,
  turn2,
  [source(elias, eliasVisual2)],
);
const secondEvent = second.projection.result.segmentation_events_created[0];
assert.equal(secondEvent.resolution, "continue_episode");
assert.equal(secondEvent.subjective_episode_id, firstEvent.subjective_episode_id);
assert.equal(secondEvent.previous_segmentation_event_id, firstEvent.segmentation_event_id);
assert.equal(secondEvent.previous_segmentation_event_hash, firstEvent.segmentation_event_hash);
assert.equal(
  secondEvent.segmentation_evidence.resolution_reason,
  "materialized_spatial_context_continuity",
);
assert.deepEqual(second.world_state.memories[elias], priorMemoriesBeforeTurn2);
const secondProjectedEpisode =
  second.projection.result.effective_episode_projection
    .episodes_by_character[elias][firstEvent.subjective_episode_id];
assert.equal(secondProjectedEpisode.source_memory_ids.length, 3);
assert.equal(secondProjectedEpisode.segmentation_event_ids.length, 2);

const turn3 = "world_turn_phase67a_003";
const eliasVisual3 = memoryFixture({
  memoryId: "memory_phase67a_elias_visual_3",
  turnId: turn3,
  sceneId: "dorm_room_12",
  description: "回到宿舍後看見阿灰擋在門邊。",
});
const turn3World = structuredClone(second.world_state);
turn3World.memories[elias].push(eliasVisual3);
const third = executeSegmentation(
  turn3World,
  turn3,
  [source(elias, eliasVisual3)],
);
const thirdEvent = third.projection.result.segmentation_events_created[0];
assert.equal(thirdEvent.resolution, "start_new_episode");
assert.notEqual(thirdEvent.subjective_episode_id, firstEvent.subjective_episode_id);
assert.notEqual(thirdEvent.subjective_episode_id, "dorm_room_12");
assert.equal(
  thirdEvent.segmentation_evidence.resolution_reason,
  "materialized_spatial_context_change",
);
assert.equal(
  thirdEvent.segmentation_evidence.scene_change_is_universal_psychological_boundary,
  false,
);
assert.equal(thirdEvent.segmentation_evidence.numeric_prediction_error_threshold_used, false);

const turn4 = "world_turn_phase67a_004";
const explicitId = "subjective_episode_explicit_training_observation";
const eliasExplicit = memoryFixture({
  memoryId: "memory_phase67a_elias_explicit",
  turnId: turn4,
  sceneId: "observation_room",
  description: "主審要求重做一次控制測試。",
  explicitEpisodeId: explicitId,
});
const turn4World = structuredClone(third.world_state);
turn4World.memories[elias].push(eliasExplicit);
const explicitMemoryBefore = structuredClone(eliasExplicit);
const fourth = executeSegmentation(
  turn4World,
  turn4,
  [source(elias, eliasExplicit)],
);
const fourthEvent = fourth.projection.result.segmentation_events_created[0];
assert.equal(fourthEvent.resolution, "preserve_explicit_binding");
assert.equal(fourthEvent.subjective_episode_id, explicitId);
assert.equal(fourthEvent.source_semantics.explicit_phase63_binding_preserved, true);
assert.deepEqual(fourth.world_state.memories[elias].at(-1), explicitMemoryBefore);

const sharedTurn = "world_turn_phase67a_multi_character";
const eliasShared = memoryFixture({
  memoryId: "memory_phase67a_elias_shared",
  turnId: sharedTurn,
  sceneId: "arena_3",
  description: "看見璃央抽出雙刃。",
});
const rionShared = memoryFixture({
  memoryId: "memory_phase67a_rion_shared",
  turnId: sharedTurn,
  sceneId: "arena_3",
  description: "看見阿灰開始縮起背甲。",
});
const multiWorld = {
  memories: {
    [elias]: [eliasShared],
    [rion]: [rionShared],
  },
};
const multi = executeSegmentation(
  multiWorld,
  sharedTurn,
  [source(rion, rionShared), source(elias, eliasShared)],
);
assert.equal(multi.projection.result.segmentation_events_created.length, 2);
const eliasMultiEvent = multi.projection.result.segmentation_events_created
  .find((event) => event.character === elias);
const rionMultiEvent = multi.projection.result.segmentation_events_created
  .find((event) => event.character === rion);
assert.ok(eliasMultiEvent);
assert.ok(rionMultiEvent);
assert.notEqual(eliasMultiEvent.subjective_episode_id, rionMultiEvent.subjective_episode_id);
assert.equal(eliasMultiEvent.previous_segmentation_event_id, null);
assert.equal(rionMultiEvent.previous_segmentation_event_id, null);

const replay = buildWorldSimulationSubjectiveEpisodeSegmentations({
  world_state: first.world_state,
  turn_id: turn1,
  source_memory_records: [
    source(elias, eliasVisual1),
    source(elias, eliasAudio1),
  ],
});
assert.equal(replay.result.new_source_memory_count, 0);
assert.equal(replay.result.segmentation_events_created.length, 0);
assert.equal(replay.result.history_references_appended.length, 0);
assert.equal(replay.result.state_transitions.length, 0);
assert.equal(replay.result.already_persisted_segmentation_event_ids.length, 1);
assert.deepEqual(replay.result.preview_world_state, first.world_state);

const tampered = structuredClone(eliasVisual1);
tampered.content.description = "竄改後的內容";
assert.throws(
  () => buildWorldSimulationSubjectiveEpisodeSegmentations({
    world_state: baseWorld,
    turn_id: turn1,
    source_memory_records: [source(elias, tampered)],
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_SUBJECTIVE_EPISODE_SEGMENTATION_SOURCE_MEMORY_MISMATCH",
);
assert.throws(
  () => buildWorldSimulationSubjectiveEpisodeSegmentations({
    world_state: baseWorld,
    turn_id: "different_turn",
    source_memory_records: [source(elias, eliasVisual1)],
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_SUBJECTIVE_EPISODE_SEGMENTATION_SOURCE_MEMORY_TURN_MISMATCH",
);
assert.throws(
  () => buildWorldSimulationSubjectiveEpisodeSegmentations({
    world_state: baseWorld,
    turn_id: turn1,
    source_memory_records: [source(rion, eliasVisual1)],
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_SUBJECTIVE_EPISODE_SEGMENTATION_SOURCE_MEMORY_UNRESOLVED",
);

const badTransitions = structuredClone(first.projection.result.state_transitions);
const badEventTransition = badTransitions.find((transition) =>
  String(transition.field).startsWith("subjective_episode_segmentation_events."),
);
badEventTransition.to.subjective_episode_id = "forged_episode";
const badQueue = buildWorldSimulationChronologicalMutationQueue({
  turn_id: `${turn1}:subjective_episode_segmentation`,
  world_state_hash: hashAgentRunValue(baseWorld),
  state_transitions: badTransitions,
  elapsed_ms: 0,
});
assert.throws(
  () => executeWorldSimulationChronologicalMutationQueue({
    world_state: baseWorld,
    preview_world_state: first.projection.result.preview_world_state,
    queue: badQueue,
  }),
  (error) => [
    "WORLD_SIMULATION_SUBJECTIVE_EPISODE_SEGMENTATION_EVENT_HASH_MISMATCH",
    "WORLD_SIMULATION_SUBJECTIVE_EPISODE_SEGMENTATION_EVENT_IDENTITY_MISMATCH",
  ].includes(error?.code),
);

const rewrittenWorld = structuredClone(first.world_state);
const oldHistory = structuredClone(rewrittenWorld.subjective_episode_segmentation_history);
const rewrittenHistory = structuredClone(oldHistory);
rewrittenHistory[0].subjective_episode_id = "rewritten_episode";
const rewriteQueue = buildWorldSimulationChronologicalMutationQueue({
  turn_id: `${turn2}:subjective_episode_segmentation`,
  world_state_hash: hashAgentRunValue(rewrittenWorld),
  state_transitions: [
    {
      entity: "world",
      field: "subjective_episode_segmentation_history",
      from: oldHistory,
      to: rewrittenHistory,
      source_layer: "subjective_episode_segmentation",
      cause: "attempt historical rewrite",
    },
  ],
  elapsed_ms: 0,
});
assert.throws(
  () => executeWorldSimulationChronologicalMutationQueue({
    world_state: rewrittenWorld,
    preview_world_state: {
      ...rewrittenWorld,
      subjective_episode_segmentation_history: rewrittenHistory,
    },
    queue: rewriteQueue,
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_SUBJECTIVE_EPISODE_SEGMENTATION_HISTORY_APPEND_ONLY_VIOLATION",
);

const turnUnknown = "world_turn_phase67a_unknown_context";
const unknownMemory = memoryFixture({
  memoryId: "memory_phase67a_unknown_context",
  turnId: turnUnknown,
  sceneId: "temporary_scene_placeholder",
  description: "只保留了模糊的感覺。",
});
delete unknownMemory.retrieval_cues.scene_id;
delete unknownMemory.internal_provenance.scene_id;
const unknownWorld = structuredClone(second.world_state);
unknownWorld.memories[elias].push(unknownMemory);
const unknown = executeSegmentation(
  unknownWorld,
  turnUnknown,
  [source(elias, unknownMemory)],
);
const unknownEvent = unknown.projection.result.segmentation_events_created[0];
assert.equal(unknownEvent.resolution, "continue_episode");
assert.equal(unknownEvent.subjective_episode_id, firstEvent.subjective_episode_id);
assert.equal(unknownEvent.segmentation_evidence.insufficient_evidence, true);
assert.equal(
  unknownEvent.segmentation_evidence.resolution_reason,
  "insufficient_boundary_evidence_preserves_open_episode",
);

console.log("Phase67A subjective episode segmentation tests passed.");
