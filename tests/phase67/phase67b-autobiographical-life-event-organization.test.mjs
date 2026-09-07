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
  buildWorldSimulationSubjectiveEpisodeSegmentations,
} from "../../server/src/world-simulation-subjective-episode-segmentation-service.mjs";
import {
  autobiographicalLifeEventOrganizationEventSchemaVersion,
  autobiographicalLifeEventOrganizationHistoryReferenceSchemaVersion,
  buildWorldSimulationAutobiographicalLifeEventOrganizationContract,
  buildWorldSimulationAutobiographicalLifeEventOrganizations,
  buildWorldSimulationAutobiographicalLifeEventResolverView,
  effectiveAutobiographicalLifeEventProjectionVersion,
  projectWorldSimulationEffectiveAutobiographicalLifeEvents,
  worldSimulationAutobiographicalLifeEventVersion,
} from "../../server/src/world-simulation-autobiographical-life-event-service.mjs";

const elias = "伊萊亞斯・諾爾";
const rion = "柊木璃央";

function memoryFixture({
  memoryId,
  turnId,
  sceneId,
  description,
}) {
  return {
    memory_id: memoryId,
    memory_type: "episodic_direct_perception",
    content: {
      kind: "visual_observation",
      description,
    },
    source: {
      kind: "direct_perception",
      sense: "visual",
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
  return {
    character,
    memory_record: structuredClone(memory),
  };
}

function executeSegmentation(worldState, turnId, sourceMemories) {
  const segmentation = buildWorldSimulationSubjectiveEpisodeSegmentations({
    world_state: worldState,
    turn_id: turnId,
    source_memory_records: sourceMemories,
  });
  const queue = buildWorldSimulationChronologicalMutationQueue({
    turn_id: `${turnId}:subjective_episode_segmentation`,
    world_state_hash: hashAgentRunValue(worldState),
    state_transitions: segmentation.result.state_transitions,
    elapsed_ms: 0,
  });
  const execution = executeWorldSimulationChronologicalMutationQueue({
    world_state: worldState,
    preview_world_state: segmentation.result.preview_world_state,
    queue,
  });
  return {
    segmentation,
    execution,
    world_state: execution.next_world_state,
    source_event_ids: [
      ...segmentation.result.segmentation_events_created.map(
        (event) => event.segmentation_event_id,
      ),
      ...segmentation.result.already_persisted_segmentation_event_ids,
    ],
  };
}

function executeLifeEvent(
  worldState,
  turnId,
  sourceSegmentationEventIds,
  organizationDecisions = [],
  resolverViewHash = null,
) {
  const organization = buildWorldSimulationAutobiographicalLifeEventOrganizations({
    world_state: worldState,
    turn_id: turnId,
    source_segmentation_event_ids: sourceSegmentationEventIds,
    organization_decisions: organizationDecisions,
    resolver_view_hash: resolverViewHash,
  });
  const queue = buildWorldSimulationChronologicalMutationQueue({
    turn_id: `${turnId}:autobiographical_life_event`,
    world_state_hash: hashAgentRunValue(worldState),
    state_transitions: organization.result.state_transitions,
    elapsed_ms: 0,
  });
  const execution = executeWorldSimulationChronologicalMutationQueue({
    world_state: worldState,
    preview_world_state: organization.result.preview_world_state,
    queue,
  });
  return {
    organization,
    queue,
    execution,
    world_state: execution.next_world_state,
  };
}

const contract = buildWorldSimulationAutobiographicalLifeEventOrganizationContract();
assert.equal(contract.version, worldSimulationAutobiographicalLifeEventVersion);
assert.equal(contract.phase, "Phase67B");
assert.equal(contract.status, "autobiographical_life_event_organization_installed");
assert.equal(contract.source_owner, "Phase67A");
assert.equal(contract.extended_autobiographical_events_modeled, true);
assert.equal(contract.repeated_event_categories_modeled, false);
assert.equal(contract.personal_semantic_memory_owner, "Phase67C");
assert.equal(contract.one_primary_life_event_parent_per_subjective_episode, true);
assert.equal(contract.immutable_organization_event_write_once_required, true);
assert.equal(contract.append_only_history_required, true);
assert.equal(contract.per_character_previous_event_hash_chain_required, true);
assert.equal(contract.effective_life_event_projection_replayable, true);
assert.equal(
  contract.effective_life_event_projection_version,
  effectiveAutobiographicalLifeEventProjectionVersion,
);
assert.equal(
  contract.new_episode_default_when_cross_episode_evidence_missing,
  "start_new_life_event",
);
assert.equal(contract.same_episode_increment_preserves_existing_parent, true);
assert.equal(contract.cross_episode_attach_requires_strong_materialized_evidence, true);
assert.deepEqual(contract.strong_attach_evidence_kinds, ["explicit_programmatic_binding"]);
assert.deepEqual(contract.auxiliary_evidence_kinds, []);
assert.equal(contract.explicit_programmatic_binding_provenance_verified, true);
assert.equal(contract.unverifiable_goal_task_project_relationship_evidence_accepted, false);
assert.equal(contract.temporal_contiguity_alone_is_sufficient, false);
assert.equal(contract.spatial_contiguity_alone_is_sufficient, false);
assert.equal(contract.numeric_similarity_threshold_modeled, false);
assert.equal(contract.freeform_llm_semantic_merge_authority, false);
assert.equal(contract.source_episode_content_copied_into_life_event_nodes, false);
assert.equal(contract.source_memory_content_copied_into_life_event_nodes, false);
assert.equal(contract.hidden_world_state_allowed, false);
assert.equal(contract.world_truth_authority_claimed, false);
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
  "phase67b_autobiographical_life_event_event_write_once_enforced",
  "phase67b_autobiographical_life_event_event_content_address_verified",
  "phase67b_source_segmentation_event_hash_pinning_enforced",
  "phase67b_source_effective_episode_hash_pinning_enforced",
  "phase67b_cross_episode_attach_strong_evidence_required",
  "phase67b_explicit_programmatic_binding_provenance_verified",
  "phase67b_unverifiable_goal_task_project_relationship_evidence_rejected",
  "phase67b_one_primary_life_event_parent_per_episode_enforced",
  "phase67b_autobiographical_life_event_history_append_only_enforced",
  "phase67b_per_character_life_event_hash_chain_enforced",
]) {
  assert.equal(mutationContract.execution[key], true, key);
}

const turn1 = "world_turn_phase67b_001";
const memory1 = memoryFixture({
  memoryId: "memory_phase67b_elias_001",
  turnId: turn1,
  sceneId: "training_room_a",
  description: "看見阿灰伏低身體等待訓練開始。",
});
const baseWorld = {
  simulation_time: "2026-09-07T18:00:00+08:00",
  memories: {
    [elias]: [memory1],
  },
};
const segmented1 = executeSegmentation(
  baseWorld,
  turn1,
  [source(elias, memory1)],
);
const view1 = buildWorldSimulationAutobiographicalLifeEventResolverView({
  world_state: segmented1.world_state,
  turn_id: turn1,
  source_segmentation_event_ids: segmented1.source_event_ids,
});
assert.equal(view1.memory_content_exposed, false);
assert.equal(view1.episode_content_exposed, false);
assert.equal(view1.whole_world_state_exposed, false);
assert.equal(view1.raw_world_event_exposed, false);
assert.equal(view1.source_episode_updates.length, 1);
assert.equal(
  JSON.stringify(view1).includes("看見阿灰伏低身體等待訓練開始"),
  false,
);

const first = executeLifeEvent(
  segmented1.world_state,
  turn1,
  segmented1.source_event_ids,
);
assert.equal(first.organization.ok, true);
assert.equal(first.organization.result.processed_source_segmentation_event_count, 1);
assert.equal(first.organization.result.organization_events_created.length, 1);
assert.equal(first.organization.result.history_references_appended.length, 1);
assert.equal(first.queue.mutation_count, 2);
assert.equal(first.execution.execution.sole_final_world_state_writer, true);

const firstEvent = first.organization.result.organization_events_created[0];
const firstSegmentationEvent =
  segmented1.segmentation.result.segmentation_events_created[0];
assert.equal(
  firstEvent.schema_version,
  autobiographicalLifeEventOrganizationEventSchemaVersion,
);
assert.equal(firstEvent.version, worldSimulationAutobiographicalLifeEventVersion);
assert.equal(firstEvent.immutable, true);
assert.equal(firstEvent.character, elias);
assert.equal(firstEvent.source_turn_id, turn1);
assert.equal(
  firstEvent.source_segmentation_event_id,
  firstSegmentationEvent.segmentation_event_id,
);
assert.equal(
  firstEvent.source_segmentation_event_hash,
  firstSegmentationEvent.segmentation_event_hash,
);
assert.equal(
  firstEvent.subjective_episode_id,
  firstSegmentationEvent.subjective_episode_id,
);
assert.equal(firstEvent.resolution, "start_new_life_event");
assert.notEqual(firstEvent.life_event_id, firstEvent.subjective_episode_id);
assert.notEqual(firstEvent.life_event_id, turn1);
assert.equal(firstEvent.previous_open_life_event_id, null);
assert.equal(firstEvent.closes_previous_life_event_id, null);
assert.equal(firstEvent.resulting_open_life_event_id, firstEvent.life_event_id);
assert.equal(firstEvent.organization_evidence.insufficient_cross_episode_evidence, true);
assert.equal(firstEvent.organization_evidence.numeric_similarity_threshold_used, false);
assert.equal(firstEvent.organization_evidence.llm_freeform_semantic_merge_used, false);
assert.equal(firstEvent.source_semantics.repeated_event_category_modeled, false);
assert.equal(firstEvent.source_semantics.personal_semantic_memory_modeled, false);
assert.equal(firstEvent.source_semantics.one_primary_life_event_parent_per_episode, true);
assert.equal(firstEvent.subjective_not_world_truth, true);
assert.equal(firstEvent.world_truth_verified, false);
assert.equal(firstEvent.confidence, null);
assert.equal(firstEvent.probability, null);
assert.equal(firstEvent.memory_content_copied, false);
assert.equal(firstEvent.episode_content_copied, false);
assert.equal(Object.hasOwn(firstEvent, "content"), false);
assert.equal(JSON.stringify(firstEvent).includes(memory1.content.description), false);
const firstEventBody = structuredClone(firstEvent);
delete firstEventBody.organization_event_hash;
assert.equal(firstEvent.organization_event_hash, hashAgentRunValue(firstEventBody));

const firstHistory =
  first.world_state.autobiographical_life_event_organization_history[0];
assert.equal(
  firstHistory.schema_version,
  autobiographicalLifeEventOrganizationHistoryReferenceSchemaVersion,
);
assert.equal(firstHistory.derived_index, true);
assert.equal(firstHistory.organization_event_id, firstEvent.organization_event_id);
assert.equal(firstHistory.organization_event_hash, firstEvent.organization_event_hash);

const firstProjection = projectWorldSimulationEffectiveAutobiographicalLifeEvents({
  world_state: first.world_state,
});
assert.equal(firstProjection.replayable_projection, true);
assert.equal(firstProjection.one_primary_parent_per_subjective_episode, true);
assert.equal(firstProjection.repeated_event_categories_modeled, false);
assert.equal(firstProjection.personal_semantic_memory_modeled, false);
assert.equal(firstProjection.episode_content_duplicated, false);
assert.equal(firstProjection.memory_content_duplicated, false);
assert.equal(firstProjection.world_truth_authority_claimed, false);
assert.equal(firstProjection.character_brain_exposure_installed, false);
assert.equal(
  firstProjection.episode_primary_parent_by_character[elias][firstEvent.subjective_episode_id],
  firstEvent.life_event_id,
);
assert.equal(
  firstProjection.life_events_by_character[elias][firstEvent.life_event_id].state,
  "open",
);

// A later Phase67A segmentation update can grow the same subjective episode.
// Phase67B must keep the original primary LifeEvent parent without rewriting it.
const turn2 = "world_turn_phase67b_002";
const memory2 = memoryFixture({
  memoryId: "memory_phase67b_elias_002",
  turnId: turn2,
  sceneId: "training_room_a",
  description: "仍在同一間訓練室看見阿灰繼續練習。",
});
const turn2World = structuredClone(first.world_state);
turn2World.memories[elias].push(memory2);
const segmented2 = executeSegmentation(
  turn2World,
  turn2,
  [source(elias, memory2)],
);
assert.equal(
  segmented2.segmentation.result.segmentation_events_created[0].subjective_episode_id,
  firstEvent.subjective_episode_id,
);
const second = executeLifeEvent(
  segmented2.world_state,
  turn2,
  segmented2.source_event_ids,
);
assert.equal(second.organization.result.organization_events_created.length, 0);
assert.equal(second.organization.result.history_references_appended.length, 0);
assert.equal(second.organization.result.already_persisted_organization_event_ids.length, 1);
assert.equal(second.queue.mutation_count, 0);
assert.equal(
  second.organization.result.effective_life_event_projection
    .episode_primary_parent_by_character[elias][firstEvent.subjective_episode_id],
  firstEvent.life_event_id,
);
assert.equal(
  second.world_state.autobiographical_life_event_organization_history.length,
  1,
);

// A new subjective episode with no strong cross-episode evidence defaults to a
// new LifeEvent and closes the previously open LifeEvent in the replayed view.
const turn3 = "world_turn_phase67b_003";
const memory3 = memoryFixture({
  memoryId: "memory_phase67b_elias_003",
  turnId: turn3,
  sceneId: "dorm_room_12",
  description: "回到宿舍後看見阿灰擋在門邊。",
});
const turn3World = structuredClone(second.world_state);
turn3World.memories[elias].push(memory3);
const segmented3 = executeSegmentation(
  turn3World,
  turn3,
  [source(elias, memory3)],
);
const thirdSegmentationEvent =
  segmented3.segmentation.result.segmentation_events_created[0];
assert.notEqual(thirdSegmentationEvent.subjective_episode_id, firstEvent.subjective_episode_id);
const third = executeLifeEvent(
  segmented3.world_state,
  turn3,
  segmented3.source_event_ids,
);
const thirdEvent = third.organization.result.organization_events_created[0];
assert.equal(thirdEvent.resolution, "start_new_life_event");
assert.notEqual(thirdEvent.life_event_id, firstEvent.life_event_id);
assert.equal(thirdEvent.previous_open_life_event_id, firstEvent.life_event_id);
assert.equal(thirdEvent.closes_previous_life_event_id, firstEvent.life_event_id);
assert.equal(
  third.organization.result.effective_life_event_projection
    .life_events_by_character[elias][firstEvent.life_event_id]
    .state,
  "closed",
);
assert.equal(
  third.organization.result.effective_life_event_projection
    .life_events_by_character[elias][thirdEvent.life_event_id]
    .state,
  "open",
);

// Phase67B v1 permits cross-episode attachment only through explicit
// programmatic binding provenance pinned to the exact bounded resolver view.
// Goal/task/project/relationship continuity remains reserved until a later
// phase materializes authoritative source-backed evidence for those cues.
const attachTurn1 = "world_turn_phase67b_attach_001";
const attachMemory1 = memoryFixture({
  memoryId: "memory_phase67b_attach_001",
  turnId: attachTurn1,
  sceneId: "hallway_a",
  description: "準備前往調律室進行同一項訓練。",
});
const attachBaseWorld = {
  memories: {
    [elias]: [attachMemory1],
  },
};
const attachSegmented1 = executeSegmentation(
  attachBaseWorld,
  attachTurn1,
  [source(elias, attachMemory1)],
);
const attachFirst = executeLifeEvent(
  attachSegmented1.world_state,
  attachTurn1,
  attachSegmented1.source_event_ids,
);
const attachLifeEventId =
  attachFirst.organization.result.organization_events_created[0].life_event_id;

const attachTurn2 = "world_turn_phase67b_attach_002";
const attachMemory2 = memoryFixture({
  memoryId: "memory_phase67b_attach_002",
  turnId: attachTurn2,
  sceneId: "training_room_b",
  description: "抵達調律室後開始同一項訓練。",
});
const attachTurn2World = structuredClone(attachFirst.world_state);
attachTurn2World.memories[elias].push(attachMemory2);
const attachSegmented2 = executeSegmentation(
  attachTurn2World,
  attachTurn2,
  [source(elias, attachMemory2)],
);
const attachView2 = buildWorldSimulationAutobiographicalLifeEventResolverView({
  world_state: attachSegmented2.world_state,
  turn_id: attachTurn2,
  source_segmentation_event_ids: attachSegmented2.source_event_ids,
});
const attachEpisodeId =
  attachSegmented2.segmentation.result.segmentation_events_created[0].subjective_episode_id;
const explicitBindingEvidence = {
  kind: "explicit_programmatic_binding",
  source_ref: `phase67b_resolver_view:${attachView2.resolver_view_hash}`,
  source_hash: attachView2.resolver_view_hash,
};
const attached = executeLifeEvent(
  attachSegmented2.world_state,
  attachTurn2,
  attachSegmented2.source_event_ids,
  [
    {
      character: elias,
      subjective_episode_id: attachEpisodeId,
      decision: "attach_to_open_life_event",
      target_life_event_id: attachLifeEventId,
      reason: "same_materialized_training_goal",
      evidence_refs: [explicitBindingEvidence],
    },
  ],
  attachView2.resolver_view_hash,
);
const attachedEvent = attached.organization.result.organization_events_created[0];
assert.equal(attachedEvent.resolution, "attach_to_open_life_event");
assert.equal(attachedEvent.life_event_id, attachLifeEventId);
assert.equal(attachedEvent.previous_open_life_event_id, attachLifeEventId);
assert.equal(attachedEvent.closes_previous_life_event_id, null);
assert.deepEqual(
  attachedEvent.organization_evidence.strong_evidence_kinds,
  ["explicit_programmatic_binding"],
);
assert.equal(
  attached.organization.result.effective_life_event_projection
    .life_events_by_character[elias][attachLifeEventId]
    .member_subjective_episode_ids.length,
  2,
);

assert.throws(
  () => buildWorldSimulationAutobiographicalLifeEventOrganizations({
    world_state: attachSegmented2.world_state,
    turn_id: attachTurn2,
    source_segmentation_event_ids: attachSegmented2.source_event_ids,
    resolver_view_hash: attachView2.resolver_view_hash,
    organization_decisions: [
      {
        character: elias,
        subjective_episode_id: attachEpisodeId,
        decision: "attach_to_open_life_event",
        target_life_event_id: attachLifeEventId,
        evidence_refs: [
          {
            kind: "goal_continuity",
            source_ref: "unverified_goal:training_session_alpha",
            source_hash: hashAgentRunValue("unverified_goal"),
          },
        ],
      },
    ],
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_EVENT_EVIDENCE_KIND_UNSUPPORTED",
);

assert.throws(
  () => buildWorldSimulationAutobiographicalLifeEventOrganizations({
    world_state: attachSegmented2.world_state,
    turn_id: attachTurn2,
    source_segmentation_event_ids: attachSegmented2.source_event_ids,
    resolver_view_hash: attachView2.resolver_view_hash,
    organization_decisions: [
      {
        character: elias,
        subjective_episode_id: attachEpisodeId,
        decision: "attach_to_open_life_event",
        target_life_event_id: attachLifeEventId,
        evidence_refs: [
          {
            kind: "explicit_programmatic_binding",
            source_ref: "phase67b_resolver_view:forged",
            source_hash: "forged",
          },
        ],
      },
    ],
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_EVENT_EVIDENCE_PROVENANCE_MISMATCH",
);

// Same-turn characters maintain independent autobiographical parent chains.
const multiTurn = "world_turn_phase67b_multi";
const eliasMultiMemory = memoryFixture({
  memoryId: "memory_phase67b_multi_elias",
  turnId: multiTurn,
  sceneId: "arena_3",
  description: "看見璃央抽出雙刃。",
});
const rionMultiMemory = memoryFixture({
  memoryId: "memory_phase67b_multi_rion",
  turnId: multiTurn,
  sceneId: "arena_3",
  description: "看見阿灰縮起背甲。",
});
const multiWorld = {
  memories: {
    [elias]: [eliasMultiMemory],
    [rion]: [rionMultiMemory],
  },
};
const multiSegmented = executeSegmentation(
  multiWorld,
  multiTurn,
  [source(rion, rionMultiMemory), source(elias, eliasMultiMemory)],
);
const multi = executeLifeEvent(
  multiSegmented.world_state,
  multiTurn,
  multiSegmented.source_event_ids,
);
assert.equal(multi.organization.result.organization_events_created.length, 2);
const eliasLife = multi.organization.result.organization_events_created
  .find((event) => event.character === elias);
const rionLife = multi.organization.result.organization_events_created
  .find((event) => event.character === rion);
assert.ok(eliasLife);
assert.ok(rionLife);
assert.notEqual(eliasLife.life_event_id, rionLife.life_event_id);
assert.equal(eliasLife.previous_organization_event_id, null);
assert.equal(rionLife.previous_organization_event_id, null);

// Idempotent replay of the same source event does not create another parent.
const replay = buildWorldSimulationAutobiographicalLifeEventOrganizations({
  world_state: first.world_state,
  turn_id: turn1,
  source_segmentation_event_ids: segmented1.source_event_ids,
});
assert.equal(replay.result.organization_events_created.length, 0);
assert.equal(replay.result.history_references_appended.length, 0);
assert.equal(replay.result.state_transitions.length, 0);
assert.equal(replay.result.already_persisted_organization_event_ids.length, 1);

// Source event tampering is rejected before organization can be derived.
const tamperedSourceWorld = structuredClone(segmented1.world_state);
tamperedSourceWorld.subjective_episode_segmentation_events[
  firstSegmentationEvent.segmentation_event_id
].subjective_episode_id = "forged_subjective_episode";
assert.throws(
  () => buildWorldSimulationAutobiographicalLifeEventOrganizations({
    world_state: tamperedSourceWorld,
    turn_id: turn1,
    source_segmentation_event_ids: segmented1.source_event_ids,
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_EVENT_SOURCE_SEGMENTATION_HASH_MISMATCH",
);

assert.throws(
  () => buildWorldSimulationAutobiographicalLifeEventOrganizations({
    world_state: segmented1.world_state,
    turn_id: "different_turn",
    source_segmentation_event_ids: segmented1.source_event_ids,
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_EVENT_SOURCE_TURN_MISMATCH",
);

// Authoritative executor rejects forged immutable organization events.
const forgedTransitions = structuredClone(first.organization.result.state_transitions);
const forgedEventTransition = forgedTransitions.find((transition) =>
  String(transition.field).startsWith(
    "autobiographical_life_event_organization_events.",
  ),
);
forgedEventTransition.to.life_event_id = "forged_life_event";
const forgedQueue = buildWorldSimulationChronologicalMutationQueue({
  turn_id: `${turn1}:autobiographical_life_event`,
  world_state_hash: hashAgentRunValue(segmented1.world_state),
  state_transitions: forgedTransitions,
  elapsed_ms: 0,
});
assert.throws(
  () => executeWorldSimulationChronologicalMutationQueue({
    world_state: segmented1.world_state,
    preview_world_state: first.organization.result.preview_world_state,
    queue: forgedQueue,
  }),
  (error) => [
    "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_EVENT_EVENT_HASH_MISMATCH",
    "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_EVENT_IDENTITY_MISMATCH",
    "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_EVENT_EVENT_IDENTITY_MISMATCH",
  ].includes(error?.code),
);

// Historical references are append-only and each episode can have one primary parent.
const oldHistory = structuredClone(
  first.world_state.autobiographical_life_event_organization_history,
);
const rewrittenHistory = structuredClone(oldHistory);
rewrittenHistory[0].life_event_id = "rewritten_life_event";
const rewriteQueue = buildWorldSimulationChronologicalMutationQueue({
  turn_id: `${turn2}:autobiographical_life_event`,
  world_state_hash: hashAgentRunValue(first.world_state),
  state_transitions: [
    {
      entity: "world",
      field: "autobiographical_life_event_organization_history",
      from: oldHistory,
      to: rewrittenHistory,
      source_layer: "autobiographical_life_event_organization",
      cause: "attempt historical rewrite",
    },
  ],
  elapsed_ms: 0,
});
assert.throws(
  () => executeWorldSimulationChronologicalMutationQueue({
    world_state: first.world_state,
    preview_world_state: {
      ...first.world_state,
      autobiographical_life_event_organization_history: rewrittenHistory,
    },
    queue: rewriteQueue,
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_EVENT_HISTORY_APPEND_ONLY_VIOLATION",
);

const duplicateHistory = [...oldHistory, structuredClone(oldHistory[0])];
const duplicateQueue = buildWorldSimulationChronologicalMutationQueue({
  turn_id: `${turn2}:autobiographical_life_event`,
  world_state_hash: hashAgentRunValue(first.world_state),
  state_transitions: [
    {
      entity: "world",
      field: "autobiographical_life_event_organization_history",
      from: oldHistory,
      to: duplicateHistory,
      source_layer: "autobiographical_life_event_organization",
      cause: "attempt duplicate primary parent",
    },
  ],
  elapsed_ms: 0,
});
assert.throws(
  () => executeWorldSimulationChronologicalMutationQueue({
    world_state: first.world_state,
    preview_world_state: {
      ...first.world_state,
      autobiographical_life_event_organization_history: duplicateHistory,
    },
    queue: duplicateQueue,
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_EVENT_EPISODE_MULTI_PARENT_FORBIDDEN",
);

console.log("Phase67B autobiographical LifeEvent organization tests passed.");
