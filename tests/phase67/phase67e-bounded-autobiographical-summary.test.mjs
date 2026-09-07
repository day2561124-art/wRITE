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
  buildWorldSimulationPersonalSemanticMemoryDerivations,
  buildWorldSimulationPersonalSemanticMemoryResolverView,
} from "../../server/src/world-simulation-personal-semantic-memory-service.mjs";
import {
  buildWorldSimulationAutobiographicalLifePeriodOrganizations,
  buildWorldSimulationAutobiographicalLifePeriodResolverView,
} from "../../server/src/world-simulation-autobiographical-life-period-service.mjs";
import {
  buildWorldSimulationAutobiographicalSummaryProjectionContract,
  projectWorldSimulationAutobiographicalSummary,
  projectWorldSimulationAutobiographicalSummaryForCharacter,
  worldSimulationAutobiographicalSummaryCharacterProjectionVersion,
  worldSimulationAutobiographicalSummaryMaxPeriods,
  worldSimulationAutobiographicalSummaryMaxSemanticsPerPeriod,
  worldSimulationAutobiographicalSummaryMaxUnperiodizedSemantics,
  worldSimulationAutobiographicalSummaryProjectionVersion,
} from "../../server/src/world-simulation-autobiographical-summary-projection-service.mjs";
import {
  buildWorldSimulationLoopContract,
} from "../../server/src/world-simulation-loop-service.mjs";
import {
  buildWorldSimulationCharacterBrainInput,
} from "../../server/src/world-simulation-character-brain-input-service.mjs";

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
  return execution.next_world_state;
}

function executeLifeEventTurn(worldState, turnId, memory) {
  const segmented = buildWorldSimulationSubjectiveEpisodeSegmentations({
    world_state: worldState,
    turn_id: turnId,
    source_memory_records: [source(elias, memory)],
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
    event_ids: life.result.organization_events_created.map(
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

const contract = buildWorldSimulationAutobiographicalSummaryProjectionContract();
assert.equal(contract.phase, "Phase67E");
assert.equal(contract.version, worldSimulationAutobiographicalSummaryProjectionVersion);
assert.equal(
  contract.character_projection_version,
  worldSimulationAutobiographicalSummaryCharacterProjectionVersion,
);
assert.deepEqual(contract.source_owners, ["Phase67B", "Phase67C", "Phase67D"]);
assert.equal(contract.engine_projection_reconstructable, true);
assert.equal(contract.consumer_specific_character_dto, true);
assert.equal(contract.committed_prior_turn_only, true);
assert.equal(contract.same_turn_autobiographical_feedback_allowed, false);
assert.equal(contract.same_turn_contamination_policy, "fail_closed");
assert.equal(contract.durable_summary_record_created, false);
assert.equal(contract.summary_history_created, false);
assert.equal(contract.phase62k_durable_write_required, false);
assert.equal(contract.world_state_mutation_allowed, false);
assert.equal(contract.freeform_llm_summary_authority, false);
assert.equal(contract.new_semantic_proposition_authority, false);
assert.equal(contract.narrative_identity_modeled, false);
assert.equal(contract.self_model_modeled, false);
assert.equal(contract.contested_personal_semantics_resolved, false);
assert.equal(contract.importance_score_modeled, false);
assert.equal(contract.salience_score_modeled, false);
assert.equal(contract.truncation_is_importance_ranking, false);
assert.equal(contract.truncation_is_salience_ranking, false);
assert.equal(contract.source_ids_hashes_engine_only, true);
assert.equal(contract.max_periods, worldSimulationAutobiographicalSummaryMaxPeriods);
assert.equal(
  contract.max_semantics_per_period,
  worldSimulationAutobiographicalSummaryMaxSemanticsPerPeriod,
);
assert.equal(
  contract.max_unperiodized_semantics,
  worldSimulationAutobiographicalSummaryMaxUnperiodizedSemantics,
);

const loopContract = buildWorldSimulationLoopContract();
assert.equal(
  loopContract.autobiographical_summary_read_projection.phase,
  "Phase67E",
);
assert.equal(
  loopContract.autobiographical_summary_read_projection.world_state_mutation_allowed,
  false,
);

const emptyWorld = {};
const emptyHash = hashAgentRunValue(emptyWorld);
const emptyEngineProjection = projectWorldSimulationAutobiographicalSummary({
  world_state: emptyWorld,
});
assert.equal(emptyEngineProjection.version, worldSimulationAutobiographicalSummaryProjectionVersion);
assert.deepEqual(emptyEngineProjection.summaries_by_character, {});
assert.equal(emptyEngineProjection.read_only, true);
assert.equal(emptyEngineProjection.durable_summary_record_created, false);
assert.equal(hashAgentRunValue(emptyWorld), emptyHash);
const emptyCharacterProjection = projectWorldSimulationAutobiographicalSummaryForCharacter({
  world_state: emptyWorld,
  character: elias,
  current_turn_id: "world_turn_phase67e_empty",
});
assert.deepEqual(emptyCharacterProjection.character_view.periods, []);
assert.deepEqual(
  emptyCharacterProjection.character_view.unperiodized_personal_semantics,
  [],
);
assert.equal(emptyCharacterProjection.character_view.narrative_summary_generated, false);

const turn1 = "world_turn_phase67e_001";
const memory1 = memoryFixture({
  memoryId: "memory_phase67e_elias_001",
  turnId: turn1,
  sceneId: "academy_arrival",
  description: "這段底層 episodic 內容不應直接出現在 67E Character DTO。",
});
let world = { memories: { [elias]: [memory1] } };
const life1 = executeLifeEventTurn(world, turn1, memory1);
world = life1.world_state;
assert.equal(life1.event_ids.length, 1);
const life1Reference = lifeRef(world, life1.event_ids[0]);

const semanticView1 = buildWorldSimulationPersonalSemanticMemoryResolverView({
  world_state: world,
  turn_id: turn1,
  source_organization_event_ids: life1.event_ids,
});
const semantic1 = buildWorldSimulationPersonalSemanticMemoryDerivations({
  world_state: world,
  turn_id: turn1,
  source_organization_event_ids: life1.event_ids,
  semantic_decisions: [{
    character: elias,
    operation: "form",
    semantic_category: "autobiographical_fact",
    semantic_key: "entered-morning-crest-academy",
    semantic_descriptor: {
      subject_scope: "self_autobiographical_experience",
      predicate: "entered_context",
      object_ref: "晨紋工學院",
      qualifiers: ["academy-life"],
    },
    source_life_event_refs: [life1Reference],
    resolver_view_hash: semanticView1.resolver_view_hash,
    source: "programmatic_personal_semantic_memory_resolver",
  }],
});
world = executeTransitions(world, turn1, "personal_semantic_memory", semantic1);
const semanticEvent1 = semantic1.result.derivation_events_created[0];

const periodView1 = buildWorldSimulationAutobiographicalLifePeriodResolverView({
  world_state: world,
  turn_id: turn1,
  source_organization_event_ids: life1.event_ids,
  source_semantic_derivation_event_ids: [semanticEvent1.derivation_event_id],
});
const period1 = buildWorldSimulationAutobiographicalLifePeriodOrganizations({
  world_state: world,
  turn_id: turn1,
  source_organization_event_ids: life1.event_ids,
  source_semantic_derivation_event_ids: [semanticEvent1.derivation_event_id],
  organization_decisions: [{
    character: elias,
    operation: "start_period",
    evidence_kind: "personal_semantic_support",
    period_descriptor: {
      subject_scope: "self_autobiographical_life",
      period_key: "剛進晨紋後的生活",
      qualifiers: ["academy-life"],
    },
    source_life_event_refs: [life1Reference],
    source_personal_semantic_refs: [semanticRef(semanticEvent1)],
    resolver_view_hash: periodView1.resolver_view_hash,
    source: "programmatic_autobiographical_life_period_organization_resolver",
  }],
});
world = executeTransitions(world, turn1, "autobiographical_life_period", period1);

const sourceWorldHash = hashAgentRunValue(world);
const engineProjection1 = projectWorldSimulationAutobiographicalSummary({
  world_state: world,
});
assert.equal(hashAgentRunValue(world), sourceWorldHash);
const engineSummary1 = engineProjection1.summaries_by_character[elias];
assert.ok(engineSummary1);
assert.equal(engineSummary1.period_anchors.length, 1);
assert.equal(engineSummary1.period_anchors[0].period_descriptor.period_key, "剛進晨紋後的生活");
assert.equal(engineSummary1.period_anchors[0].personal_semantics.length, 1);
assert.equal(
  engineSummary1.period_anchors[0].personal_semantics[0].semantic_memory_id,
  semanticEvent1.semantic_memory_id,
);
assert.equal(engineSummary1.period_anchors[0].member_life_event_ids.length, 1);
assert.equal(engineSummary1.read_only, true);
assert.equal(engineSummary1.reconstructable, true);
assert.equal(engineSummary1.durable_summary_record_created, false);
assert.equal(engineSummary1.freeform_summary_generated, false);
assert.ok(engineSummary1.summary_hash);
assert.ok(engineSummary1.input_history_hash);

const priorTurnView1 = projectWorldSimulationAutobiographicalSummaryForCharacter({
  world_state: world,
  character: elias,
  current_turn_id: "world_turn_phase67e_002",
});
assert.equal(
  priorTurnView1.version,
  worldSimulationAutobiographicalSummaryCharacterProjectionVersion,
);
assert.equal(priorTurnView1.character_view.periods.length, 1);
assert.deepEqual(priorTurnView1.character_view.periods[0], {
  description: "剛進晨紋後的生活",
  qualifiers: ["academy-life"],
  state: "open",
  personal_semantics: [{
    category: "autobiographical_fact",
    predicate: "entered_context",
    object: "晨紋工學院",
    qualifiers: ["academy-life"],
    status: "supported",
    subjective_not_world_truth: true,
    epistemic_resolution_applied: false,
  }],
  personal_semantics_truncated: false,
  subjective_not_world_truth: true,
});
assert.equal(priorTurnView1.character_view.narrative_summary_generated, false);
assert.equal(priorTurnView1.audit.persistent_summary_written, false);
assert.equal(priorTurnView1.audit.phase62k_write_used, false);
assert.equal(priorTurnView1.audit.truncation_used_as_importance_ranking, false);
assert.equal(priorTurnView1.audit.truncation_used_as_salience_ranking, false);
assert.equal(priorTurnView1.audit.source_ids_exposed_to_character_brain, false);
assert.equal(priorTurnView1.audit.source_hashes_exposed_to_character_brain, false);
assert.equal(priorTurnView1.audit.freeform_summary_generated, false);
assert.equal(priorTurnView1.audit.new_semantic_propositions_generated, false);
assert.equal(priorTurnView1.audit.narrative_identity_modeled, false);
assert.equal(priorTurnView1.audit.self_model_modeled, false);
assert.equal(priorTurnView1.audit.world_truth_authority_exposed, false);
assert.equal(
  JSON.stringify(priorTurnView1.character_view).includes(memory1.content.description),
  false,
);

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
    autobiographical_context: priorTurnView1.character_view,
  },
  candidate_action_intents: [],
  boundaries: {
    recollection_reinstatement_v3_installed: true,
    selective_working_memory_output_gating_v5_installed: true,
    autobiographical_summary_read_projection_installed: true,
  },
});
assert.deepEqual(
  brainInput.cognition.autobiographical_context,
  priorTurnView1.character_view,
  "final Character Brain ingress must preserve the bounded Phase67E autobiography",
);

for (const forbidden of [
  "life_period_id",
  "life_event_id",
  "semantic_memory_id",
  "organization_event_id",
  "derivation_event_id",
  "projection_hash",
  "summary_hash",
  "source_turn_id",
]) {
  assert.equal(
    JSON.stringify(priorTurnView1.character_view).includes(forbidden),
    false,
    forbidden,
  );
}

// Add later counterevidence. Phase67E must preserve contested autobiography
// without resolving it into a belief verdict or rewriting the period summary.
const turn2 = "world_turn_phase67e_002";
const memory2 = memoryFixture({
  memoryId: "memory_phase67e_elias_002",
  turnId: turn2,
  sceneId: "academy_followup",
  description: "後續經驗提供與既有 personal semantic 不一致的 autobiographical evidence。",
});
world = structuredClone(world);
world.memories[elias].push(memory2);
const life2 = executeLifeEventTurn(world, turn2, memory2);
world = life2.world_state;
const life2Reference = lifeRef(world, life2.event_ids[0]);
const semanticView2 = buildWorldSimulationPersonalSemanticMemoryResolverView({
  world_state: world,
  turn_id: turn2,
  source_organization_event_ids: life2.event_ids,
});
const semantic2 = buildWorldSimulationPersonalSemanticMemoryDerivations({
  world_state: world,
  turn_id: turn2,
  source_organization_event_ids: life2.event_ids,
  semantic_decisions: [{
    character: elias,
    operation: "counterevidence",
    semantic_memory_id: semanticEvent1.semantic_memory_id,
    semantic_category: semanticEvent1.semantic_category,
    semantic_key: semanticEvent1.semantic_key,
    source_life_event_refs: [life2Reference],
    resolver_view_hash: semanticView2.resolver_view_hash,
    source: "programmatic_personal_semantic_memory_resolver",
  }],
});
world = executeTransitions(world, turn2, "personal_semantic_memory", semantic2);

assert.throws(
  () => projectWorldSimulationAutobiographicalSummaryForCharacter({
    world_state: world,
    character: elias,
    current_turn_id: turn2,
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_AUTOBIOGRAPHICAL_SUMMARY_SAME_TURN_CONTAMINATION",
);

const futureView = projectWorldSimulationAutobiographicalSummaryForCharacter({
  world_state: world,
  character: elias,
  current_turn_id: "world_turn_phase67e_003",
});
assert.equal(futureView.character_view.periods.length, 1);
assert.equal(
  futureView.character_view.periods[0].personal_semantics[0].status,
  "contested",
);
assert.equal(
  futureView.character_view.periods[0].personal_semantics[0].epistemic_resolution_applied,
  false,
);
assert.equal(futureView.audit.contested_personal_semantics_resolved, false);
assert.equal(futureView.audit.belief_resolution_applied, false);

// Character scope is strict. A character with no autobiographical evidence sees
// an empty bounded autobiography, not Elias's engine-side summary.
const otherView = projectWorldSimulationAutobiographicalSummaryForCharacter({
  world_state: world,
  character: "柊木璃央",
  current_turn_id: "world_turn_phase67e_003",
});
assert.deepEqual(otherView.character_view.periods, []);
assert.deepEqual(otherView.character_view.unperiodized_personal_semantics, []);
assert.equal(JSON.stringify(otherView.character_view).includes("晨紋工學院"), false);

// Rebuilding from identical committed history is deterministic and does not
// create any durable summary state.
const replayA = projectWorldSimulationAutobiographicalSummary({ world_state: world });
const replayB = projectWorldSimulationAutobiographicalSummary({ world_state: structuredClone(world) });
assert.equal(replayA.projection_hash, replayB.projection_hash);
assert.equal(
  Object.hasOwn(world, "autobiographical_summary_history"),
  false,
);
assert.equal(
  Object.hasOwn(world, "autobiographical_summary_events"),
  false,
);

console.log("Phase67E bounded autobiographical summary projection tests passed.");
