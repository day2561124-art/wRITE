import assert from "node:assert/strict";

import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import {
  buildWorldSimulationChronologicalMutationQueue,
  buildWorldSimulationChronologicalMutationQueueContract,
  executeWorldSimulationChronologicalMutationQueue,
} from "../../server/src/world-simulation-chronological-mutation-queue-service.mjs";
import {
  buildWorldSimulationSubjectiveEpisodeSegmentations,
} from "../../server/src/world-simulation-subjective-episode-segmentation-service.mjs";
import {
  buildWorldSimulationAutobiographicalLifeEventOrganizations,
} from "../../server/src/world-simulation-autobiographical-life-event-service.mjs";
import {
  buildWorldSimulationPersonalSemanticMemoryDerivations,
  buildWorldSimulationPersonalSemanticMemoryResolverView,
} from "../../server/src/world-simulation-personal-semantic-memory-service.mjs";
import {
  autobiographicalLifePeriodOrganizationEventSchemaVersion,
  autobiographicalLifePeriodOrganizationHistoryReferenceSchemaVersion,
  buildWorldSimulationAutobiographicalLifePeriodContract,
  buildWorldSimulationAutobiographicalLifePeriodOrganizations,
  buildWorldSimulationAutobiographicalLifePeriodResolverView,
  effectiveAutobiographicalLifePeriodProjectionVersion,
  projectWorldSimulationEffectiveAutobiographicalLifePeriods,
  worldSimulationAutobiographicalLifePeriodVersion,
} from "../../server/src/world-simulation-autobiographical-life-period-service.mjs";

const elias = "伊萊亞斯・諾爾";

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
  return { queue, execution, world_state: execution.next_world_state };
}

function executeLifeEventTurn(worldState, turnId, memory) {
  const segmented = buildWorldSimulationSubjectiveEpisodeSegmentations({
    world_state: worldState,
    turn_id: turnId,
    source_memory_records: [source(elias, memory)],
  });
  const segmentationExecution = executeTransitions(
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
    world_state: segmentationExecution.world_state,
    turn_id: turnId,
    source_segmentation_event_ids: segmentationIds,
    organization_decisions: [],
  });
  const lifeExecution = executeTransitions(
    segmentationExecution.world_state,
    turnId,
    "autobiographical_life_event",
    life,
  );
  return {
    world_state: lifeExecution.world_state,
    organization: life,
    source_event_ids: life.result.organization_events_created.map(
      (item) => item.organization_event_id,
    ),
  };
}

function lifeRef(worldState, organizationEventId) {
  const event = worldState.autobiographical_life_event_organization_events[organizationEventId];
  return {
    life_event_id: event.life_event_id,
    organization_event_id: event.organization_event_id,
    organization_event_hash: event.organization_event_hash,
  };
}

function semanticRef(event) {
  return {
    semantic_memory_id: event.semantic_memory_id,
    derivation_event_id: event.derivation_event_id,
    derivation_event_hash: event.derivation_event_hash,
  };
}

function periodDecision({
  character = elias,
  operation,
  evidenceKind,
  periodDescriptor = null,
  lifePeriodId = null,
  lifeRefs = [],
  semanticRefs = [],
  resolverViewHash,
}) {
  return {
    character,
    operation,
    evidence_kind: evidenceKind,
    ...(periodDescriptor ? { period_descriptor: periodDescriptor } : {}),
    ...(lifePeriodId ? { life_period_id: lifePeriodId } : {}),
    source_life_event_refs: lifeRefs,
    source_personal_semantic_refs: semanticRefs,
    resolver_view_hash: resolverViewHash,
    source: "programmatic_autobiographical_life_period_organization_resolver",
  };
}

function executePeriod(worldState, turnId, currentLifeIds, currentSemanticIds, decisions) {
  const built = buildWorldSimulationAutobiographicalLifePeriodOrganizations({
    world_state: worldState,
    turn_id: turnId,
    source_organization_event_ids: currentLifeIds,
    source_semantic_derivation_event_ids: currentSemanticIds,
    organization_decisions: decisions,
  });
  const executed = executeTransitions(
    worldState,
    turnId,
    "autobiographical_life_period",
    built,
  );
  return { built, ...executed };
}

const contract = buildWorldSimulationAutobiographicalLifePeriodContract();
assert.equal(contract.phase, "Phase67D");
assert.equal(contract.version, worldSimulationAutobiographicalLifePeriodVersion);
assert.deepEqual(contract.supported_operations, [
  "start_period",
  "attach_life_event",
  "close_period",
]);
assert.deepEqual(contract.supported_evidence_kinds, [
  "explicit_programmatic_binding",
  "personal_semantic_support",
]);
assert.equal(contract.overlapping_periods_allowed, true);
assert.equal(contract.many_to_many_life_event_membership, true);
assert.equal(contract.one_primary_period_parent_per_life_event, false);
assert.equal(contract.temporal_adjacency_alone_is_sufficient, false);
assert.equal(contract.calendar_bucket_is_sufficient, false);
assert.equal(contract.fixed_duration_threshold_modeled, false);
assert.equal(contract.current_turn_autobiographical_trigger_required, true);
assert.equal(contract.cultural_life_script_assumptions_used, false);
assert.equal(contract.freeform_llm_period_authority, false);
assert.equal(contract.same_turn_character_brain_feedback_allowed, false);

const mutationContract = buildWorldSimulationChronologicalMutationQueueContract();
for (const key of [
  "phase67d_autobiographical_life_period_event_write_once_enforced",
  "phase67d_autobiographical_life_period_event_content_address_verified",
  "phase67d_source_life_event_hash_pinning_enforced",
  "phase67d_source_personal_semantic_hash_pinning_enforced",
  "phase67d_current_turn_autobiographical_trigger_enforced",
  "phase67d_same_character_evidence_enforced",
  "phase67d_many_to_many_life_event_membership_enforced",
  "phase67d_overlapping_periods_allowed",
  "phase67d_temporal_adjacency_alone_rejected",
  "phase67d_calendar_bucket_membership_rejected",
  "phase67d_life_period_history_append_only_enforced",
  "phase67d_per_character_life_period_hash_chain_enforced",
  "phase67d_per_period_hash_chain_enforced",
  "phase67d_closed_period_mutation_rejected",
]) {
  assert.equal(mutationContract.execution[key], true, key);
}

const turn1 = "world_turn_phase67d_001";
const memory1 = memoryFixture({
  memoryId: "memory_phase67d_elias_001",
  turnId: turn1,
  sceneId: "academy_arrival",
  description: "伊萊亞斯進入晨紋後開始新的校園生活。",
});
const baseWorld = { memories: { [elias]: [memory1] } };
const life1 = executeLifeEventTurn(baseWorld, turn1, memory1);
assert.equal(life1.source_event_ids.length, 1);
const life1Ref = lifeRef(life1.world_state, life1.source_event_ids[0]);

// Create materialized Phase67C autobiographical semantic evidence on the same turn.
const semanticView1 = buildWorldSimulationPersonalSemanticMemoryResolverView({
  world_state: life1.world_state,
  turn_id: turn1,
  source_organization_event_ids: life1.source_event_ids,
});
const semantic1 = buildWorldSimulationPersonalSemanticMemoryDerivations({
  world_state: life1.world_state,
  turn_id: turn1,
  source_organization_event_ids: life1.source_event_ids,
  semantic_decisions: [{
    character: elias,
    operation: "form",
    semantic_category: "autobiographical_fact",
    semantic_key: "entered-morning-crest-academy",
    semantic_descriptor: {
      subject_scope: "self_autobiographical_experience",
      predicate: "entered_context",
      object_ref: "morning-crest-academy",
      qualifiers: ["academy-life"],
    },
    source_life_event_refs: [life1Ref],
    resolver_view_hash: semanticView1.resolver_view_hash,
    source: "programmatic_personal_semantic_memory_resolver",
  }],
});
const semanticExecution1 = executeTransitions(
  life1.world_state,
  turn1,
  "personal_semantic_memory",
  semantic1,
);
const semanticEvent1 = semantic1.result.derivation_events_created[0];
const semanticEvent1Ref = semanticRef(semanticEvent1);

const periodView1 = buildWorldSimulationAutobiographicalLifePeriodResolverView({
  world_state: semanticExecution1.world_state,
  turn_id: turn1,
  source_organization_event_ids: life1.source_event_ids,
  source_semantic_derivation_event_ids: [semanticEvent1.derivation_event_id],
});
assert.equal(periodView1.overlapping_periods_allowed, true);
assert.equal(periodView1.many_to_many_life_event_membership, true);
assert.equal(periodView1.one_primary_period_parent_per_life_event, false);
assert.equal(periodView1.temporal_adjacency_alone_is_sufficient, false);
assert.equal(periodView1.calendar_bucket_is_sufficient, false);
assert.equal(periodView1.life_event_content_exposed, false);
assert.equal(periodView1.memory_content_exposed, false);
assert.equal(JSON.stringify(periodView1).includes(memory1.content.description), false);

const academyDescriptor = {
  subject_scope: "self_autobiographical_life",
  period_key: "early-morning-crest-academy-life",
  qualifiers: ["academy-life"],
};
const dormDescriptor = {
  subject_scope: "self_autobiographical_life",
  period_key: "dormitory-life",
  qualifiers: ["academy-life", "dormitory"],
};

// One LifeEvent may simultaneously belong to two overlapping LifePeriods.
const started = executePeriod(
  semanticExecution1.world_state,
  turn1,
  life1.source_event_ids,
  [semanticEvent1.derivation_event_id],
  [
    periodDecision({
      operation: "start_period",
      evidenceKind: "personal_semantic_support",
      periodDescriptor: academyDescriptor,
      lifeRefs: [life1Ref],
      semanticRefs: [semanticEvent1Ref],
      resolverViewHash: periodView1.resolver_view_hash,
    }),
    periodDecision({
      operation: "start_period",
      evidenceKind: "explicit_programmatic_binding",
      periodDescriptor: dormDescriptor,
      lifeRefs: [life1Ref],
      semanticRefs: [],
      resolverViewHash: periodView1.resolver_view_hash,
    }),
  ],
);
assert.equal(started.built.result.organization_events_created.length, 2);
assert.equal(started.queue.mutation_count, 3);
assert.equal(started.execution.execution.sole_final_world_state_writer, true);
const [academyStart, dormStart] = started.built.result.organization_events_created;
for (const event of [academyStart, dormStart]) {
  assert.equal(event.schema_version, autobiographicalLifePeriodOrganizationEventSchemaVersion);
  assert.equal(event.version, worldSimulationAutobiographicalLifePeriodVersion);
  assert.equal(event.operation, "start_period");
  assert.equal(event.subjective_not_world_truth, true);
  assert.equal(event.world_truth_verified, false);
  assert.equal(event.confidence, null);
  assert.equal(event.probability, null);
  assert.equal(event.organization_evidence.temporal_adjacency_alone_used, false);
  assert.equal(event.organization_evidence.calendar_bucket_used, false);
  assert.equal(event.organization_evidence.fixed_duration_threshold_used, false);
  assert.equal(event.source_semantics.one_primary_period_parent_per_life_event, false);
  assert.equal(event.life_event_content_copied, false);
  assert.equal(event.personal_semantic_content_copied, false);
  assert.equal(event.memory_content_copied, false);
}
assert.equal(
  started.world_state.autobiographical_life_period_organization_history[0].schema_version,
  autobiographicalLifePeriodOrganizationHistoryReferenceSchemaVersion,
);
let projection = projectWorldSimulationEffectiveAutobiographicalLifePeriods({
  world_state: started.world_state,
});
assert.equal(projection.version, effectiveAutobiographicalLifePeriodProjectionVersion);
assert.equal(projection.replayable_projection, true);
assert.equal(projection.overlapping_periods_allowed, true);
assert.equal(projection.many_to_many_life_event_membership, true);
assert.deepEqual(
  [...projection.period_ids_by_life_event_by_character[elias][life1Ref.life_event_id]].sort(),
  [academyStart.life_period_id, dormStart.life_period_id].sort(),
);
assert.equal(projection.open_period_ids_by_character[elias].length, 2);

// A later LifeEvent can be attached to both still-open overlapping periods.
const turn2 = "world_turn_phase67d_002";
const memory2 = memoryFixture({
  memoryId: "memory_phase67d_elias_002",
  turnId: turn2,
  sceneId: "dormitory_room",
  description: "伊萊亞斯在宿舍開始固定的住宿生活。",
});
const world2 = structuredClone(started.world_state);
world2.memories[elias].push(memory2);
const life2 = executeLifeEventTurn(world2, turn2, memory2);
const life2Ref = lifeRef(life2.world_state, life2.source_event_ids[0]);
const periodView2 = buildWorldSimulationAutobiographicalLifePeriodResolverView({
  world_state: life2.world_state,
  turn_id: turn2,
  source_organization_event_ids: life2.source_event_ids,
  source_semantic_derivation_event_ids: [],
});

// Old evidence alone cannot trigger a new durable period operation.
assert.throws(
  () => buildWorldSimulationAutobiographicalLifePeriodOrganizations({
    world_state: life2.world_state,
    turn_id: turn2,
    source_organization_event_ids: life2.source_event_ids,
    source_semantic_derivation_event_ids: [],
    organization_decisions: [periodDecision({
      operation: "attach_life_event",
      evidenceKind: "explicit_programmatic_binding",
      lifePeriodId: academyStart.life_period_id,
      lifeRefs: [life1Ref],
      resolverViewHash: periodView2.resolver_view_hash,
    })],
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_CURRENT_TURN_TRIGGER_REQUIRED",
);

const attached = executePeriod(
  life2.world_state,
  turn2,
  life2.source_event_ids,
  [],
  [
    periodDecision({
      operation: "attach_life_event",
      evidenceKind: "explicit_programmatic_binding",
      lifePeriodId: academyStart.life_period_id,
      lifeRefs: [life2Ref],
      resolverViewHash: periodView2.resolver_view_hash,
    }),
    periodDecision({
      operation: "attach_life_event",
      evidenceKind: "explicit_programmatic_binding",
      lifePeriodId: dormStart.life_period_id,
      lifeRefs: [life2Ref],
      resolverViewHash: periodView2.resolver_view_hash,
    }),
  ],
);
projection = projectWorldSimulationEffectiveAutobiographicalLifePeriods({
  world_state: attached.world_state,
});
assert.deepEqual(
  [...projection.period_ids_by_life_event_by_character[elias][life2Ref.life_event_id]].sort(),
  [academyStart.life_period_id, dormStart.life_period_id].sort(),
);
assert.equal(
  projection.periods_by_character[elias][academyStart.life_period_id].member_life_event_ids.length,
  2,
);
assert.equal(
  projection.periods_by_character[elias][dormStart.life_period_id].member_life_event_ids.length,
  2,
);

// Close one period with a current-turn autobiographical trigger while the other remains open.
const turn3 = "world_turn_phase67d_003";
const memory3 = memoryFixture({
  memoryId: "memory_phase67d_elias_003",
  turnId: turn3,
  sceneId: "training_room",
  description: "伊萊亞斯的生活重心轉向新的訓練安排。",
});
const world3 = structuredClone(attached.world_state);
world3.memories[elias].push(memory3);
const life3 = executeLifeEventTurn(world3, turn3, memory3);
const life3Ref = lifeRef(life3.world_state, life3.source_event_ids[0]);
const periodView3 = buildWorldSimulationAutobiographicalLifePeriodResolverView({
  world_state: life3.world_state,
  turn_id: turn3,
  source_organization_event_ids: life3.source_event_ids,
  source_semantic_derivation_event_ids: [],
});
const closed = executePeriod(
  life3.world_state,
  turn3,
  life3.source_event_ids,
  [],
  [periodDecision({
    operation: "close_period",
    evidenceKind: "explicit_programmatic_binding",
    lifePeriodId: dormStart.life_period_id,
    lifeRefs: [life3Ref],
    resolverViewHash: periodView3.resolver_view_hash,
  })],
);
projection = projectWorldSimulationEffectiveAutobiographicalLifePeriods({
  world_state: closed.world_state,
});
assert.equal(projection.periods_by_character[elias][dormStart.life_period_id].state, "closed");
assert.equal(projection.periods_by_character[elias][academyStart.life_period_id].state, "open");
assert.equal(projection.open_period_ids_by_character[elias].includes(dormStart.life_period_id), false);
assert.equal(projection.open_period_ids_by_character[elias].includes(academyStart.life_period_id), true);

// Closed periods cannot be silently reopened or extended by a later event.
const turn4 = "world_turn_phase67d_004";
const memory4 = memoryFixture({
  memoryId: "memory_phase67d_elias_004",
  turnId: turn4,
  sceneId: "training_field",
  description: "新的訓練生活繼續展開。",
});
const world4 = structuredClone(closed.world_state);
world4.memories[elias].push(memory4);
const life4 = executeLifeEventTurn(world4, turn4, memory4);
const life4Ref = lifeRef(life4.world_state, life4.source_event_ids[0]);
const periodView4 = buildWorldSimulationAutobiographicalLifePeriodResolverView({
  world_state: life4.world_state,
  turn_id: turn4,
  source_organization_event_ids: life4.source_event_ids,
  source_semantic_derivation_event_ids: [],
});
assert.throws(
  () => buildWorldSimulationAutobiographicalLifePeriodOrganizations({
    world_state: life4.world_state,
    turn_id: turn4,
    source_organization_event_ids: life4.source_event_ids,
    source_semantic_derivation_event_ids: [],
    organization_decisions: [periodDecision({
      operation: "attach_life_event",
      evidenceKind: "explicit_programmatic_binding",
      lifePeriodId: dormStart.life_period_id,
      lifeRefs: [life4Ref],
      resolverViewHash: periodView4.resolver_view_hash,
    })],
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_CLOSED_PERIOD_MUTATION_FORBIDDEN",
);

// Phase62K independently rejects forged immutable Phase67D event content.
const forgedTransitions = structuredClone(started.built.result.state_transitions);
const forgedEventTransition = forgedTransitions.find((item) =>
  String(item.field).startsWith("autobiographical_life_period_organization_events."),
);
forgedEventTransition.to.period_descriptor.period_key = "forged-calendar-bucket";
const forgedQueue = buildWorldSimulationChronologicalMutationQueue({
  turn_id: `${turn1}:autobiographical_life_period`,
  world_state_hash: hashAgentRunValue(semanticExecution1.world_state),
  state_transitions: forgedTransitions,
  elapsed_ms: 0,
});
assert.throws(
  () => executeWorldSimulationChronologicalMutationQueue({
    world_state: semanticExecution1.world_state,
    preview_world_state: started.built.result.preview_world_state,
    queue: forgedQueue,
  }),
  (error) => [
    "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_EVENT_HASH_MISMATCH",
    "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_DESCRIPTOR_HASH_MISMATCH",
    "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_PERIOD_EVENT_IDENTITY_MISMATCH",
  ].includes(error?.code),
);

console.log("Phase67D autobiographical LifePeriod organization tests passed.");
