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
  buildWorldSimulationAutobiographicalLifeEventOrganizations,
} from "../../server/src/world-simulation-autobiographical-life-event-service.mjs";
import {
  buildWorldSimulationPersonalSemanticMemoryContract,
  buildWorldSimulationPersonalSemanticMemoryDerivations,
  buildWorldSimulationPersonalSemanticMemoryResolverView,
  effectivePersonalSemanticMemoryProjectionVersion,
  personalSemanticDerivationEventSchemaVersion,
  personalSemanticDerivationHistoryReferenceSchemaVersion,
  projectWorldSimulationEffectivePersonalSemanticMemories,
  worldSimulationPersonalSemanticMemoryVersion,
} from "../../server/src/world-simulation-personal-semantic-memory-service.mjs";

const elias = "伊萊亞斯・諾爾";
const rion = "柊木璃央";

function memoryFixture({ memoryId, turnId, sceneId, description }) {
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
    world_state: execution.next_world_state,
    source_event_ids: [
      ...segmentation.result.segmentation_events_created.map(
        (event) => event.segmentation_event_id,
      ),
      ...segmentation.result.already_persisted_segmentation_event_ids,
    ],
  };
}

function executeLifeEvent(worldState, turnId, sourceSegmentationEventIds) {
  const organization = buildWorldSimulationAutobiographicalLifeEventOrganizations({
    world_state: worldState,
    turn_id: turnId,
    source_segmentation_event_ids: sourceSegmentationEventIds,
    organization_decisions: [],
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
    world_state: execution.next_world_state,
    source_event_ids: organization.result.organization_events_created
      .map((event) => event.organization_event_id),
  };
}

function executeSemantic(worldState, turnId, sourceOrganizationEventIds, decisions) {
  const derivation = buildWorldSimulationPersonalSemanticMemoryDerivations({
    world_state: worldState,
    turn_id: turnId,
    source_organization_event_ids: sourceOrganizationEventIds,
    semantic_decisions: decisions,
  });
  const queue = buildWorldSimulationChronologicalMutationQueue({
    turn_id: `${turnId}:personal_semantic_memory`,
    world_state_hash: hashAgentRunValue(worldState),
    state_transitions: derivation.result.state_transitions,
    elapsed_ms: 0,
  });
  const execution = executeWorldSimulationChronologicalMutationQueue({
    world_state: worldState,
    preview_world_state: derivation.result.preview_world_state,
    queue,
  });
  return {
    derivation,
    queue,
    execution,
    world_state: execution.next_world_state,
  };
}

function lifeEventRef(worldState, organizationEventId) {
  const event = worldState.autobiographical_life_event_organization_events[organizationEventId];
  return {
    life_event_id: event.life_event_id,
    organization_event_id: event.organization_event_id,
    organization_event_hash: event.organization_event_hash,
  };
}

function semanticDecision({
  character,
  operation,
  semanticCategory,
  semanticKey,
  descriptor,
  refs,
  semanticMemoryId = null,
  resolverViewHash,
}) {
  return {
    character,
    operation,
    semantic_category: semanticCategory,
    semantic_key: semanticKey,
    ...(descriptor ? { semantic_descriptor: descriptor } : {}),
    ...(semanticMemoryId ? { semantic_memory_id: semanticMemoryId } : {}),
    source_life_event_refs: refs,
    resolver_view_hash: resolverViewHash,
    source: "programmatic_personal_semantic_memory_resolver",
  };
}

const contract = buildWorldSimulationPersonalSemanticMemoryContract();
assert.equal(contract.version, worldSimulationPersonalSemanticMemoryVersion);
assert.equal(contract.phase, "Phase67C");
assert.deepEqual(contract.supported_categories, [
  "recurring_event_pattern",
  "autobiographical_fact",
]);
assert.deepEqual(contract.supported_operations, [
  "form",
  "support",
  "counterevidence",
]);
assert.equal(contract.experience_near_only, true);
assert.equal(contract.recurring_event_pattern_auto_promoted_by_count, false);
assert.equal(contract.eager_semanticization_allowed, false);
assert.equal(contract.semanticization_requires_explicit_programmatic_decision, true);
assert.equal(contract.current_turn_life_event_trigger_required, true);
assert.equal(contract.counterevidence_preserved_without_epistemic_resolution, true);
assert.equal(contract.trait_inference_modeled, false);
assert.equal(contract.role_identity_modeled, false);
assert.equal(contract.self_model_modeled, false);
assert.equal(contract.belief_engine_duplicated, false);
assert.equal(contract.epistemic_acceptance_owner, "Phase65/66");
assert.equal(contract.world_truth_authority_claimed, false);
assert.equal(contract.freeform_llm_reflection_authority, false);
assert.equal(contract.separate_retrieval_engine_installed, false);
assert.equal(contract.same_turn_character_brain_feedback_allowed, false);

const mutationContract = buildWorldSimulationChronologicalMutationQueueContract();
for (const key of [
  "phase67c_personal_semantic_derivation_event_write_once_enforced",
  "phase67c_personal_semantic_derivation_event_content_address_verified",
  "phase67c_source_life_event_hash_pinning_enforced",
  "phase67c_current_turn_life_event_trigger_enforced",
  "phase67c_same_character_life_event_evidence_enforced",
  "phase67c_recurring_pattern_distinct_life_events_required",
  "phase67c_recurring_pattern_count_auto_promotion_rejected",
  "phase67c_personal_semantic_history_append_only_enforced",
  "phase67c_per_character_derivation_hash_chain_enforced",
  "phase67c_per_semantic_memory_hash_chain_enforced",
  "phase67c_semantic_identity_rewrite_rejected",
  "phase67c_counterevidence_preserved_without_belief_resolution",
]) {
  assert.equal(mutationContract.execution[key], true, key);
}

const turn1 = "world_turn_phase67c_001";
const memory1 = memoryFixture({
  memoryId: "memory_phase67c_elias_001",
  turnId: turn1,
  sceneId: "selection_arena",
  description: "阿灰在選拔中自行改變行進方向。",
});
const baseWorld = {
  memories: {
    [elias]: [memory1],
  },
};
const segmented1 = executeSegmentation(baseWorld, turn1, [source(elias, memory1)]);
const life1 = executeLifeEvent(segmented1.world_state, turn1, segmented1.source_event_ids);
assert.equal(life1.source_event_ids.length, 1);

// Missing resolver/decision is a deliberate no-op: one LifeEvent never becomes
// a semantic memory just because it exists.
const noSemantic = executeSemantic(
  life1.world_state,
  turn1,
  life1.source_event_ids,
  [],
);
assert.equal(noSemantic.derivation.result.semantic_decision_count, 0);
assert.equal(noSemantic.derivation.result.derivation_events_created.length, 0);
assert.equal(noSemantic.queue.mutation_count, 0);

const turn2 = "world_turn_phase67c_002";
const memory2 = memoryFixture({
  memoryId: "memory_phase67c_elias_002",
  turnId: turn2,
  sceneId: "field_test_corridor",
  description: "阿灰在翌日場地測試中再次自行尋找通路。",
});
const world2 = structuredClone(noSemantic.world_state);
world2.memories[elias].push(memory2);
const segmented2 = executeSegmentation(world2, turn2, [source(elias, memory2)]);
const life2 = executeLifeEvent(segmented2.world_state, turn2, segmented2.source_event_ids);
assert.equal(life2.source_event_ids.length, 1);

const view2 = buildWorldSimulationPersonalSemanticMemoryResolverView({
  world_state: life2.world_state,
  turn_id: turn2,
  source_organization_event_ids: life2.source_event_ids,
});
assert.equal(view2.eager_semanticization, false);
assert.equal(view2.recurring_event_pattern_auto_promoted_by_count, false);
assert.equal(view2.memory_content_exposed, false);
assert.equal(view2.episode_content_exposed, false);
assert.equal(view2.life_event_content_exposed, false);
assert.equal(JSON.stringify(view2).includes(memory1.content.description), false);
assert.equal(JSON.stringify(view2).includes(memory2.content.description), false);

const life1Ref = lifeEventRef(life2.world_state, life1.source_event_ids[0]);
const life2Ref = lifeEventRef(life2.world_state, life2.source_event_ids[0]);
const recurringDescriptor = {
  subject_scope: "self_autobiographical_experience",
  predicate: "recurring_experience",
  object_ref: "a-hui-autonomous-route-selection",
  qualifiers: ["a-hui", "route-selection"],
};

// A semantic derivation must be triggered by at least one current-turn Phase67B
// LifeEvent update. Old autobiographical evidence may support the decision, but
// old evidence alone cannot create a new durable semantic derivation on an
// otherwise unrelated turn.
assert.throws(
  () => buildWorldSimulationPersonalSemanticMemoryDerivations({
    world_state: life2.world_state,
    turn_id: turn2,
    source_organization_event_ids: life2.source_event_ids,
    semantic_decisions: [semanticDecision({
      character: elias,
      operation: "form",
      semanticCategory: "autobiographical_fact",
      semanticKey: "old-evidence-only-invalid",
      descriptor: {
        subject_scope: "self_autobiographical_experience",
        predicate: "participated_in",
        object_ref: "historical-selection-event",
        qualifiers: [],
      },
      refs: [life1Ref],
      resolverViewHash: view2.resolver_view_hash,
    })],
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_PERSONAL_SEMANTIC_CURRENT_TURN_TRIGGER_REQUIRED",
);

const formed = executeSemantic(
  life2.world_state,
  turn2,
  life2.source_event_ids,
  [semanticDecision({
    character: elias,
    operation: "form",
    semanticCategory: "recurring_event_pattern",
    semanticKey: "a-hui-autonomous-route-selection",
    descriptor: recurringDescriptor,
    refs: [life1Ref, life2Ref],
    resolverViewHash: view2.resolver_view_hash,
  })],
);
assert.equal(formed.derivation.result.derivation_events_created.length, 1);
assert.equal(formed.derivation.result.history_references_appended.length, 1);
assert.equal(formed.queue.mutation_count, 2);
assert.equal(formed.execution.execution.sole_final_world_state_writer, true);
const formEvent = formed.derivation.result.derivation_events_created[0];
assert.equal(formEvent.schema_version, personalSemanticDerivationEventSchemaVersion);
assert.equal(formEvent.version, worldSimulationPersonalSemanticMemoryVersion);
assert.equal(formEvent.operation, "form");
assert.equal(formEvent.semantic_category, "recurring_event_pattern");
assert.equal(formEvent.subjective_not_world_truth, true);
assert.equal(formEvent.world_truth_verified, false);
assert.equal(formEvent.epistemic_acceptance_decided, false);
assert.equal(formEvent.belief_engine_used, false);
assert.equal(formEvent.confidence, null);
assert.equal(formEvent.probability, null);
assert.equal(formEvent.memory_content_copied, false);
assert.equal(formEvent.episode_content_copied, false);
assert.equal(formEvent.life_event_content_copied, false);
assert.equal(formEvent.derivation_evidence.eager_semanticization_used, false);
assert.equal(formEvent.derivation_evidence.recurrence_count_auto_promoted, false);
assert.equal(formEvent.derivation_evidence.freeform_llm_reflection_authority_used, false);
assert.equal(formEvent.source_semantics.traits_modeled, false);
assert.equal(formEvent.source_semantics.self_model_modeled, false);
assert.equal(formEvent.source_semantics.belief_revision_modeled, false);
assert.equal(JSON.stringify(formEvent).includes(memory1.content.description), false);
const formBody = structuredClone(formEvent);
delete formBody.derivation_event_hash;
assert.equal(formEvent.derivation_event_hash, hashAgentRunValue(formBody));

const historyRef = formed.world_state.personal_semantic_derivation_history[0];
assert.equal(
  historyRef.schema_version,
  personalSemanticDerivationHistoryReferenceSchemaVersion,
);
assert.equal(historyRef.derived_index, true);
assert.equal(historyRef.derivation_event_id, formEvent.derivation_event_id);

let projection = projectWorldSimulationEffectivePersonalSemanticMemories({
  world_state: formed.world_state,
});
assert.equal(projection.version, effectivePersonalSemanticMemoryProjectionVersion);
assert.equal(projection.replayable_projection, true);
assert.equal(projection.traits_modeled, false);
assert.equal(projection.self_model_modeled, false);
assert.equal(projection.belief_authority_claimed, false);
assert.equal(projection.world_truth_authority_claimed, false);
let effective = projection.memories_by_character[elias][formEvent.semantic_memory_id];
assert.equal(effective.state, "supported");
assert.equal(effective.support_life_event_refs.length, 2);
assert.equal(effective.counterevidence_life_event_refs.length, 0);

// Structural minimum is not an automatic promotion rule: one source cannot
// form a recurring pattern even with an explicit decision.
assert.throws(
  () => buildWorldSimulationPersonalSemanticMemoryDerivations({
    world_state: life2.world_state,
    turn_id: turn2,
    source_organization_event_ids: life2.source_event_ids,
    semantic_decisions: [semanticDecision({
      character: elias,
      operation: "form",
      semanticCategory: "recurring_event_pattern",
      semanticKey: "invalid-single-instance-pattern",
      descriptor: {
        subject_scope: "self_autobiographical_experience",
        predicate: "recurring_experience",
        object_ref: "single-instance",
        qualifiers: [],
      },
      refs: [life2Ref],
      resolverViewHash: view2.resolver_view_hash,
    })],
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_PERSONAL_SEMANTIC_RECURRING_PATTERN_DISTINCT_EVENTS_REQUIRED",
);

assert.throws(
  () => buildWorldSimulationPersonalSemanticMemoryDerivations({
    world_state: life2.world_state,
    turn_id: turn2,
    source_organization_event_ids: life2.source_event_ids,
    semantic_decisions: [{
      character: elias,
      operation: "form",
      semantic_category: "trait",
      semantic_key: "i-am-introverted",
      semantic_descriptor: recurringDescriptor,
      source_life_event_refs: [life1Ref, life2Ref],
      resolver_view_hash: view2.resolver_view_hash,
    }],
  }),
  (error) => error?.code === "WORLD_SIMULATION_PERSONAL_SEMANTIC_CATEGORY_UNSUPPORTED",
);

// A later distinct LifeEvent can add support without rewriting the original
// semantic formation event or descriptor.
const turn3 = "world_turn_phase67c_003";
const memory3 = memoryFixture({
  memoryId: "memory_phase67c_elias_003",
  turnId: turn3,
  sceneId: "dormitory_room",
  description: "阿灰回到宿舍後又自行選擇了站位。",
});
const world3 = structuredClone(formed.world_state);
world3.memories[elias].push(memory3);
const segmented3 = executeSegmentation(world3, turn3, [source(elias, memory3)]);
const life3 = executeLifeEvent(segmented3.world_state, turn3, segmented3.source_event_ids);
const view3 = buildWorldSimulationPersonalSemanticMemoryResolverView({
  world_state: life3.world_state,
  turn_id: turn3,
  source_organization_event_ids: life3.source_event_ids,
});
const life3Ref = lifeEventRef(life3.world_state, life3.source_event_ids[0]);
const supported = executeSemantic(
  life3.world_state,
  turn3,
  life3.source_event_ids,
  [semanticDecision({
    character: elias,
    operation: "support",
    semanticCategory: "recurring_event_pattern",
    semanticKey: formEvent.semantic_key,
    refs: [life3Ref],
    semanticMemoryId: formEvent.semantic_memory_id,
    resolverViewHash: view3.resolver_view_hash,
  })],
);
const supportEvent = supported.derivation.result.derivation_events_created[0];
assert.equal(supportEvent.operation, "support");
assert.equal(supportEvent.previous_semantic_event_id, formEvent.derivation_event_id);
assert.deepEqual(supportEvent.semantic_descriptor, formEvent.semantic_descriptor);
assert.equal(
  supported.world_state.personal_semantic_derivation_events[formEvent.derivation_event_id]
    .derivation_event_hash,
  formEvent.derivation_event_hash,
);
projection = projectWorldSimulationEffectivePersonalSemanticMemories({
  world_state: supported.world_state,
});
effective = projection.memories_by_character[elias][formEvent.semantic_memory_id];
assert.equal(effective.support_life_event_refs.length, 3);
assert.equal(effective.state, "supported");

// Counterevidence is preserved as autobiographical semantic evidence only. It
// marks the projection contested and does not perform belief acceptance/revision.
const turn4 = "world_turn_phase67c_004";
const memory4 = memoryFixture({
  memoryId: "memory_phase67c_elias_004",
  turnId: turn4,
  sceneId: "medical_room",
  description: "一次不同情境中阿灰沒有自行改變路線。",
});
const world4 = structuredClone(supported.world_state);
world4.memories[elias].push(memory4);
const segmented4 = executeSegmentation(world4, turn4, [source(elias, memory4)]);
const life4 = executeLifeEvent(segmented4.world_state, turn4, segmented4.source_event_ids);
const view4 = buildWorldSimulationPersonalSemanticMemoryResolverView({
  world_state: life4.world_state,
  turn_id: turn4,
  source_organization_event_ids: life4.source_event_ids,
});
const life4Ref = lifeEventRef(life4.world_state, life4.source_event_ids[0]);
const contested = executeSemantic(
  life4.world_state,
  turn4,
  life4.source_event_ids,
  [semanticDecision({
    character: elias,
    operation: "counterevidence",
    semanticCategory: "recurring_event_pattern",
    semanticKey: formEvent.semantic_key,
    refs: [life4Ref],
    semanticMemoryId: formEvent.semantic_memory_id,
    resolverViewHash: view4.resolver_view_hash,
  })],
);
const counterEvent = contested.derivation.result.derivation_events_created[0];
assert.equal(counterEvent.operation, "counterevidence");
assert.equal(counterEvent.epistemic_acceptance_decided, false);
assert.equal(counterEvent.belief_engine_used, false);
projection = projectWorldSimulationEffectivePersonalSemanticMemories({
  world_state: contested.world_state,
});
effective = projection.memories_by_character[elias][formEvent.semantic_memory_id];
assert.equal(effective.state, "contested");
assert.equal(effective.support_life_event_refs.length, 3);
assert.equal(effective.counterevidence_life_event_refs.length, 1);
assert.equal(effective.epistemic_acceptance_decided, false);
assert.equal(effective.confidence, null);
assert.equal(effective.probability, null);

// Experience-near autobiographical facts may be formed from one LifeEvent,
// but they remain subjective semantic memory rather than World Truth.
const factTurn = "world_turn_phase67c_fact";
const factMemory = memoryFixture({
  memoryId: "memory_phase67c_fact_elias",
  turnId: factTurn,
  sceneId: "selection_waiting_room",
  description: "在等待區參加晨紋代表選拔。",
});
const factWorldBase = {
  memories: {
    [elias]: [factMemory],
  },
};
const factSegmented = executeSegmentation(
  factWorldBase,
  factTurn,
  [source(elias, factMemory)],
);
const factLife = executeLifeEvent(
  factSegmented.world_state,
  factTurn,
  factSegmented.source_event_ids,
);
const factView = buildWorldSimulationPersonalSemanticMemoryResolverView({
  world_state: factLife.world_state,
  turn_id: factTurn,
  source_organization_event_ids: factLife.source_event_ids,
});
const factRef = lifeEventRef(factLife.world_state, factLife.source_event_ids[0]);
const fact = executeSemantic(
  factLife.world_state,
  factTurn,
  factLife.source_event_ids,
  [semanticDecision({
    character: elias,
    operation: "form",
    semanticCategory: "autobiographical_fact",
    semanticKey: "participated-in-morning-crest-selection",
    descriptor: {
      subject_scope: "self_autobiographical_experience",
      predicate: "participated_in",
      object_ref: "morning-crest-representative-selection",
      qualifiers: [],
    },
    refs: [factRef],
    resolverViewHash: factView.resolver_view_hash,
  })],
);
const factEvent = fact.derivation.result.derivation_events_created[0];
assert.equal(factEvent.semantic_category, "autobiographical_fact");
assert.equal(factEvent.world_truth_verified, false);
assert.equal(factEvent.subjective_not_world_truth, true);

// Same-character evidence is mandatory.
const multiTurn = "world_turn_phase67c_multi";
const eliasMemory = memoryFixture({
  memoryId: "memory_phase67c_multi_elias",
  turnId: multiTurn,
  sceneId: "arena_multi_elias",
  description: "伊萊亞斯進入場地。",
});
const rionMemory = memoryFixture({
  memoryId: "memory_phase67c_multi_rion",
  turnId: multiTurn,
  sceneId: "arena_multi_rion",
  description: "璃央進入場地。",
});
const multiWorld = {
  memories: {
    [elias]: [eliasMemory],
    [rion]: [rionMemory],
  },
};
const multiSegmented = executeSegmentation(
  multiWorld,
  multiTurn,
  [source(elias, eliasMemory), source(rion, rionMemory)],
);
const multiLife = executeLifeEvent(
  multiSegmented.world_state,
  multiTurn,
  multiSegmented.source_event_ids,
);
const eliasOrg = multiLife.organization.result.organization_events_created
  .find((event) => event.character === elias);
const rionOrg = multiLife.organization.result.organization_events_created
  .find((event) => event.character === rion);
const multiView = buildWorldSimulationPersonalSemanticMemoryResolverView({
  world_state: multiLife.world_state,
  turn_id: multiTurn,
  source_organization_event_ids: multiLife.source_event_ids,
});
assert.throws(
  () => buildWorldSimulationPersonalSemanticMemoryDerivations({
    world_state: multiLife.world_state,
    turn_id: multiTurn,
    source_organization_event_ids: multiLife.source_event_ids,
    semantic_decisions: [semanticDecision({
      character: elias,
      operation: "form",
      semanticCategory: "autobiographical_fact",
      semanticKey: "cross-character-invalid",
      descriptor: {
        subject_scope: "self_autobiographical_experience",
        predicate: "observed_event",
        object_ref: "invalid-cross-character",
        qualifiers: [],
      },
      refs: [lifeEventRef(multiLife.world_state, rionOrg.organization_event_id)],
      resolverViewHash: multiView.resolver_view_hash,
    })],
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_PERSONAL_SEMANTIC_CROSS_CHARACTER_EVIDENCE_FORBIDDEN",
);
assert.ok(eliasOrg);

// Phase62K rejects forged immutable semantic events and historical rewrites.
const forgedTransitions = structuredClone(formed.derivation.result.state_transitions);
const forgedEventTransition = forgedTransitions.find((transition) =>
  String(transition.field).startsWith("personal_semantic_derivation_events."),
);
forgedEventTransition.to.semantic_key = "forged-semantic-key";
const forgedQueue = buildWorldSimulationChronologicalMutationQueue({
  turn_id: `${turn2}:personal_semantic_memory`,
  world_state_hash: hashAgentRunValue(life2.world_state),
  state_transitions: forgedTransitions,
  elapsed_ms: 0,
});
assert.throws(
  () => executeWorldSimulationChronologicalMutationQueue({
    world_state: life2.world_state,
    preview_world_state: formed.derivation.result.preview_world_state,
    queue: forgedQueue,
  }),
  (error) => [
    "WORLD_SIMULATION_PERSONAL_SEMANTIC_EVENT_HASH_MISMATCH",
    "WORLD_SIMULATION_PERSONAL_SEMANTIC_IDENTITY_MISMATCH",
    "WORLD_SIMULATION_PERSONAL_SEMANTIC_EVENT_IDENTITY_MISMATCH",
  ].includes(error?.code),
);

const oldHistory = structuredClone(
  formed.world_state.personal_semantic_derivation_history,
);
const rewrittenHistory = structuredClone(oldHistory);
rewrittenHistory[0].semantic_memory_id = "rewritten-semantic-memory";
const rewriteQueue = buildWorldSimulationChronologicalMutationQueue({
  turn_id: `${turn3}:personal_semantic_memory`,
  world_state_hash: hashAgentRunValue(formed.world_state),
  state_transitions: [{
    entity: "world",
    field: "personal_semantic_derivation_history",
    from: oldHistory,
    to: rewrittenHistory,
    source_layer: "personal_semantic_memory",
    cause: "attempt historical rewrite",
  }],
  elapsed_ms: 0,
});
assert.throws(
  () => executeWorldSimulationChronologicalMutationQueue({
    world_state: formed.world_state,
    preview_world_state: {
      ...formed.world_state,
      personal_semantic_derivation_history: rewrittenHistory,
    },
    queue: rewriteQueue,
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_PERSONAL_SEMANTIC_HISTORY_APPEND_ONLY_VIOLATION",
);

console.log("Phase67C personal semantic memory tests passed.");
