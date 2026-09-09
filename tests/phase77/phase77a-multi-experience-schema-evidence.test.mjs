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
  projectWorldSimulationPostOutcomeSubjectivePerception,
} from "../../server/src/world-simulation-post-outcome-subjective-perception-service.mjs";
import {
  bridgeWorldSimulationPostOutcomeSubjectiveExperienceToMemory,
} from "../../server/src/world-simulation-post-outcome-subjective-memory-bridge-service.mjs";
import {
  formWorldSimulationSubjectiveMemories,
} from "../../server/src/world-simulation-subjective-memory-formation-service.mjs";
import {
  buildWorldSimulationSubjectiveEpisodeSegmentations,
} from "../../server/src/world-simulation-subjective-episode-segmentation-service.mjs";
import {
  buildWorldSimulationAutobiographicalLifeEventOrganizations,
} from "../../server/src/world-simulation-autobiographical-life-event-service.mjs";
import {
  buildWorldSimulationMultiExperienceSchemaEvidenceContract,
  buildWorldSimulationMultiExperienceSchemaEvidenceView,
  worldSimulationMultiExperienceSchemaEvidenceVersion,
} from "../../server/src/world-simulation-multi-experience-schema-evidence-service.mjs";

const elias = "伊萊亞斯・諾爾";
const rion = "柊木璃央";

function applyTransitions(worldState, previewWorldState, turnId, layer, stateTransitions) {
  const queue = buildWorldSimulationChronologicalMutationQueue({
    turn_id: `${turnId}:${layer}`,
    world_state_hash: hashAgentRunValue(worldState),
    state_transitions: stateTransitions,
    elapsed_ms: 0,
  });
  return executeWorldSimulationChronologicalMutationQueue({
    world_state: worldState,
    preview_world_state: previewWorldState,
    queue,
  }).next_world_state;
}

function appendPostOutcomeActionLifeEvent(worldState, {
  character,
  turnId,
  sceneId,
  actionId,
  action,
  perceivedResult,
  perceivedStatus,
}) {
  const selected = [{
    character,
    selection: "candidate_action_intent",
    action_id: actionId,
    intent: action,
  }];
  const phase76a = projectWorldSimulationPostOutcomeSubjectivePerception({
    turn_id: turnId,
    selected_action_intents: selected,
    action_outcomes: [{
      actor: character,
      action_id: actionId,
      result: `engine_hidden_result_${turnId}`,
      causal_evidence: `engine_hidden_causal_evidence_${turnId}`,
      exact_force_newtons: 9001,
      character_experience: {
        performed: true,
        perceived_result: perceivedResult,
        perceived_status: perceivedStatus,
      },
    }],
    state_transitions: [],
  });
  const bridge = bridgeWorldSimulationPostOutcomeSubjectiveExperienceToMemory({
    turn_id: turnId,
    selected_action_intents: selected,
    post_outcome_subjective_perception_projection: phase76a,
  });
  const formation = formWorldSimulationSubjectiveMemories({
    world_state: worldState,
    turn_id: turnId,
    event: {
      event_id: `event_${turnId}`,
      scene_id: sceneId,
      simulation_time: `${turnId}:simulation`,
    },
    decision_packets: bridge.memory_formation_packets,
    encoding_decisions: [],
    episode_bindings: [],
  });
  assert.equal(formation.result.created_memory_count, 1);
  const memory = formation.result.character_updates[0].memory_records[0];
  const memoryWorld = structuredClone(worldState);
  if (!memoryWorld.memories) memoryWorld.memories = {};
  if (!Array.isArray(memoryWorld.memories[character])) memoryWorld.memories[character] = [];
  memoryWorld.memories[character].push(structuredClone(memory));

  const segmentation = buildWorldSimulationSubjectiveEpisodeSegmentations({
    world_state: memoryWorld,
    turn_id: turnId,
    source_memory_records: [{ character, memory_record: structuredClone(memory) }],
  });
  const segmentedWorld = applyTransitions(
    memoryWorld,
    segmentation.result.preview_world_state,
    turnId,
    "subjective_episode_segmentation",
    segmentation.result.state_transitions,
  );
  const segmentationEventIds = [
    ...segmentation.result.segmentation_events_created.map((event) => event.segmentation_event_id),
    ...segmentation.result.already_persisted_segmentation_event_ids,
  ];
  const organization = buildWorldSimulationAutobiographicalLifeEventOrganizations({
    world_state: segmentedWorld,
    turn_id: turnId,
    source_segmentation_event_ids: segmentationEventIds,
    organization_decisions: [],
  });
  const organizedWorld = applyTransitions(
    segmentedWorld,
    organization.result.preview_world_state,
    turnId,
    "autobiographical_life_event",
    organization.result.state_transitions,
  );
  return {
    world_state: organizedWorld,
    organization_event_ids: organization.result.organization_events_created
      .map((event) => event.organization_event_id),
    organization_events: organization.result.organization_events_created,
    memory,
  };
}

const contract = buildWorldSimulationMultiExperienceSchemaEvidenceContract();
assert.equal(contract.phase, "Phase77A");
assert.equal(contract.version, worldSimulationMultiExperienceSchemaEvidenceVersion);
assert.equal(contract.current_turn_phase67b_anchor_required, true);
assert.equal(contract.same_character_only, true);
assert.equal(contract.distinct_life_events_required_for_future_schema, 2);
assert.equal(contract.phase76b_post_outcome_action_experience_only, true);
assert.equal(contract.individual_episode_specificity_preserved, true);
assert.equal(contract.relational_alignment_performed, false);
assert.equal(contract.schema_induction_performed, false);
assert.equal(contract.schema_semantic_content_authored, false);
assert.equal(contract.phase77b_relational_alignment_owner, true);
assert.equal(contract.phase67c_durable_semantic_owner, true);
assert.equal(contract.recurrence_count_auto_promotes_schema, false);
assert.equal(contract.numeric_similarity_threshold_modeled, false);
assert.equal(contract.numeric_confidence_probability_modeled, false);
assert.equal(contract.raw_world_state_exposed, false);
assert.equal(contract.raw_action_outcome_exposed, false);
assert.equal(contract.hidden_causal_evidence_exposed, false);
assert.equal(contract.other_character_private_state_exposed, false);
assert.equal(contract.internal_life_event_episode_memory_lineage_exposed_to_future_aligner, false);
assert.equal(contract.same_turn_character_brain_feedback_allowed, false);

const baseWorld = {
  simulation_time: "2026-09-09T12:30:00.000Z",
  characters: {
    [elias]: {},
    [rion]: {},
  },
  memories: {},
};

const first = appendPostOutcomeActionLifeEvent(baseWorld, {
  character: elias,
  turnId: "phase77a-turn-001",
  sceneId: "phase77a-training-room",
  actionId: "phase77a-probe-first",
  action: "先用低風險動作試探對方的反應",
  perceivedResult: "對方提前暴露了防守習慣",
  perceivedStatus: "取得更多線索",
});
assert.equal(first.organization_events.length, 1);

const firstView = buildWorldSimulationMultiExperienceSchemaEvidenceView({
  world_state: first.world_state,
  turn_id: "phase77a-turn-001",
  source_organization_event_ids: first.organization_event_ids,
});
assert.equal(firstView.ready_character_count, 0);
assert.equal(firstView.resolver_view.character_contexts.length, 1);
assert.equal(firstView.resolver_view.character_contexts[0].current_anchor_count, 1);
assert.equal(firstView.resolver_view.character_contexts[0].prior_comparison_candidate_count, 0);
assert.equal(firstView.resolver_view.character_contexts[0].comparison_ready, false);
assert.equal(firstView.audit.schema_induction_performed, false);
assert.equal(firstView.audit.phase67c_semantic_decision_emitted, false);

// An unrelated character may have comparable-looking experience in the same
// shared world, but Phase77A must never mix it into Elias's evidence context.
const other = appendPostOutcomeActionLifeEvent(first.world_state, {
  character: rion,
  turnId: "phase77a-turn-rion",
  sceneId: "phase77a-rion-arena",
  actionId: "phase77a-rion-probe",
  action: "先試探再決定攻擊節奏",
  perceivedResult: "看見了對手的反制方向",
  perceivedStatus: "得到線索",
});

const second = appendPostOutcomeActionLifeEvent(other.world_state, {
  character: elias,
  turnId: "phase77a-turn-002",
  sceneId: "phase77a-rooftop",
  actionId: "phase77a-probe-second",
  action: "先製造一個小動靜觀察對手如何回應",
  perceivedResult: "對手的注意力轉向聲音來源",
  perceivedStatus: "成功觀察反應",
});
assert.equal(second.organization_events.length, 1);
assert.notEqual(
  second.organization_events[0].life_event_id,
  first.organization_events[0].life_event_id,
  "Different scenes without strong cross-episode binding should remain distinct LifeEvents.",
);

const view = buildWorldSimulationMultiExperienceSchemaEvidenceView({
  world_state: second.world_state,
  turn_id: "phase77a-turn-002",
  source_organization_event_ids: second.organization_event_ids,
});
assert.equal(view.version, worldSimulationMultiExperienceSchemaEvidenceVersion);
assert.equal(view.ready_character_count, 1);
assert.equal(view.resolver_view.character_contexts.length, 1);
const context = view.resolver_view.character_contexts[0];
assert.equal(context.character, elias);
assert.equal(context.current_anchor_count, 1);
assert.equal(context.prior_comparison_candidate_count, 1);
assert.equal(context.comparison_ready, true);
assert.equal(context.minimum_distinct_life_events_for_schema, 2);
assert.equal(context.current_anchor_evidence[0].role, "current_anchor");
assert.equal(context.prior_comparison_evidence[0].role, "prior_comparison_candidate");
assert.equal(
  context.current_anchor_evidence[0].bounded_experiences[0].action,
  "先製造一個小動靜觀察對手如何回應",
);
assert.equal(
  context.prior_comparison_evidence[0].bounded_experiences[0].action,
  "先用低風險動作試探對方的反應",
);
assert.equal(
  context.prior_comparison_evidence[0].bounded_experiences[0].perceived_status,
  "取得更多線索",
);
assert.equal(view.resolver_view.comparison_requirements.minimum_distinct_life_events, 2);
assert.equal(view.resolver_view.comparison_requirements.recurrence_count_is_not_schema_authority, true);
assert.equal(view.resolver_view.boundaries.individual_experience_specificity_preserved, true);
assert.equal(view.resolver_view.boundaries.relational_alignment_requested, false);
assert.equal(view.resolver_view.boundaries.semantic_schema_authoring_requested, false);
assert.equal(view.resolver_view.boundaries.internal_lineage_exposed, false);
assert.equal(view.audit.same_character_only, true);
assert.equal(view.audit.recurrence_count_auto_promoted, false);
assert.equal(view.audit.relational_alignment_performed, false);
assert.equal(view.audit.schema_induction_performed, false);
assert.equal(view.audit.phase67c_semantic_decision_emitted, false);
assert.equal(view.audit.world_truth_authority_claimed, false);
assert.equal(view.audit.numeric_similarity_confidence_probability_modeled, false);
assert.equal(view.internal_lineage.length, 2);
assert.equal(
  view.internal_lineage.every((item) => item.character === elias),
  true,
  "Internal lineage must remain same-character even though another character has history.",
);

const publicSerialized = JSON.stringify(view.resolver_view);
for (const hidden of [
  first.organization_events[0].life_event_id,
  first.organization_events[0].organization_event_id,
  first.memory.memory_id,
  second.organization_events[0].life_event_id,
  second.organization_events[0].organization_event_id,
  second.memory.memory_id,
  other.organization_events[0].life_event_id,
  other.memory.memory_id,
  "engine_hidden_result_phase77a-turn-001",
  "engine_hidden_causal_evidence_phase77a-turn-001",
  "engine_hidden_result_phase77a-turn-002",
  "exact_force_newtons",
  "internal_provenance",
]) {
  assert.equal(
    publicSerialized.includes(hidden),
    false,
    `Phase77A public evidence view leaked hidden/internal value: ${hidden}`,
  );
}
assert.equal(publicSerialized.includes(rion), false);

const firstInternal = view.internal_lineage.find((item) =>
  item.life_event_id === first.organization_events[0].life_event_id);
assert.ok(firstInternal);
assert.equal(firstInternal.source_memory_refs[0].memory_id, first.memory.memory_id);
assert.ok(firstInternal.source_memory_refs[0].memory_hash);
assert.ok(firstInternal.latest_organization_event_hash);
assert.ok(firstInternal.source_episode_refs.length >= 1);

assert.throws(
  () => buildWorldSimulationMultiExperienceSchemaEvidenceView({
    world_state: second.world_state,
    turn_id: "wrong-turn",
    source_organization_event_ids: second.organization_event_ids,
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_MULTI_EXPERIENCE_SCHEMA_EVIDENCE_CURRENT_TURN_MISMATCH",
);

const tamperedWorld = structuredClone(second.world_state);
const priorMemory = tamperedWorld.memories[elias]
  .find((memory) => memory.memory_id === first.memory.memory_id);
priorMemory.content.perceived_status = "竄改後的經驗狀態";
assert.throws(
  () => buildWorldSimulationMultiExperienceSchemaEvidenceView({
    world_state: tamperedWorld,
    turn_id: "phase77a-turn-002",
    source_organization_event_ids: second.organization_event_ids,
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_MULTI_EXPERIENCE_SCHEMA_EVIDENCE_MEMORY_HASH_MISMATCH",
  "Phase77A must reject historical experience content that no longer matches immutable Phase67A memory lineage.",
);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const loopSource = fs.readFileSync(
  path.resolve(__dirname, "../../server/src/world-simulation-loop-service.mjs"),
  "utf8",
);
const stateSource = fs.readFileSync(
  path.resolve(__dirname, "../../server/src/world-simulation-state-service.mjs"),
  "utf8",
);
const phase67bIndex = loopSource.indexOf(
  "const autobiographicalLifeEventOrganizationMutationExecution =",
);
const phase77aIndex = loopSource.indexOf(
  "const multiExperienceSchemaEvidence =",
  phase67bIndex,
);
const phase67cIndex = loopSource.indexOf(
  "const personalSemanticDecisionResolution =",
  phase77aIndex,
);
assert.ok(
  phase67bIndex >= 0 && phase77aIndex > phase67bIndex && phase67cIndex > phase77aIndex,
  "Phase77A must run after canonical Phase67B materialization and before Phase67C semantic authority.",
);
assert.match(loopSource, /multi_experience_schema_evidence:/);
assert.match(stateSource, /multi_experience_schema_evidence:/);
assert.match(loopSource, /relational_alignment_performed:\s*false/);
assert.match(loopSource, /schema_induction_performed:\s*false/);
assert.match(loopSource, /phase67c_durable_semantic_owner:\s*true/);
assert.match(loopSource, /same_turn_character_brain_feedback_allowed:\s*false/);

console.log("Phase77A multi-experience schema evidence assembly tests passed.");
