import assert from "node:assert/strict";
import fs from "node:fs";

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
  buildWorldSimulationPersonalSemanticMemoryDerivations,
  buildWorldSimulationPersonalSemanticMemoryResolverView,
  projectWorldSimulationEffectivePersonalSemanticMemories,
} from "../../server/src/world-simulation-personal-semantic-memory-service.mjs";
import {
  buildWorldSimulationContextualSchemaRefinementEvidenceContract,
  buildWorldSimulationContextualSchemaRefinementEvidenceView,
  worldSimulationContextualSchemaRefinementEvidenceVersion,
} from "../../server/src/world-simulation-contextual-schema-refinement-evidence-service.mjs";

const character = "伊萊亞斯・諾爾";
const descriptor = {
  subject_scope: "self_autobiographical_experience",
  predicate: "先試探反應再決定主要手段",
  object_ref: "低成本試探後依觀察結果調整行動",
  qualifiers: ["資訊不足時", "可安全試探時"],
};

function applyTransitions(worldState, previewWorldState, stateTransitions, turnId) {
  const queue = buildWorldSimulationChronologicalMutationQueue({
    turn_id: turnId,
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

function appendActionExperience(worldState, {
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
  const perception = projectWorldSimulationPostOutcomeSubjectivePerception({
    turn_id: turnId,
    selected_action_intents: selected,
    action_outcomes: [{
      actor: character,
      action_id: actionId,
      result: `engine_hidden_${turnId}`,
      causal_evidence: `engine_hidden_cause_${turnId}`,
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
    post_outcome_subjective_perception_projection: perception,
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
  const memory = formation.result.character_updates[0].memory_records[0];
  const memoryWorld = structuredClone(worldState);
  if (!memoryWorld.memories) memoryWorld.memories = {};
  if (!Array.isArray(memoryWorld.memories[character])) memoryWorld.memories[character] = [];
  memoryWorld.memories[character].push(structuredClone(memory));
  const segmentation = buildWorldSimulationSubjectiveEpisodeSegmentations({
    world_state: memoryWorld,
    turn_id: turnId,
    source_memory_records: [{ character, memory_record: memory }],
  });
  const segmented = applyTransitions(
    memoryWorld,
    segmentation.result.preview_world_state,
    segmentation.result.state_transitions,
    `${turnId}:subjective_episode_segmentation`,
  );
  const segmentationIds = [
    ...segmentation.result.segmentation_events_created.map((event) => event.segmentation_event_id),
    ...segmentation.result.already_persisted_segmentation_event_ids,
  ];
  const organization = buildWorldSimulationAutobiographicalLifeEventOrganizations({
    world_state: segmented,
    turn_id: turnId,
    source_segmentation_event_ids: segmentationIds,
    organization_decisions: [],
  });
  const organized = applyTransitions(
    segmented,
    organization.result.preview_world_state,
    organization.result.state_transitions,
    `${turnId}:autobiographical_life_event`,
  );
  const event = organization.result.organization_events_created[0];
  assert.ok(event?.organization_event_id);
  return {
    world_state: organized,
    organization_event_id: event.organization_event_id,
    life_event_ref: {
      life_event_id: event.life_event_id,
      organization_event_id: event.organization_event_id,
      organization_event_hash: event.organization_event_hash,
    },
  };
}

function deriveSemantic(worldState, turnId, sourceOrganizationEventIds, decisions) {
  const result = buildWorldSimulationPersonalSemanticMemoryDerivations({
    world_state: worldState,
    turn_id: turnId,
    source_organization_event_ids: sourceOrganizationEventIds,
    semantic_decisions: decisions,
  });
  return {
    result,
    world_state: applyTransitions(
      worldState,
      result.result.preview_world_state,
      result.result.state_transitions,
      `${turnId}:personal_semantic_memory`,
    ),
  };
}

const contract = buildWorldSimulationContextualSchemaRefinementEvidenceContract();
assert.equal(contract.phase, "Phase78A");
assert.equal(contract.version, worldSimulationContextualSchemaRefinementEvidenceVersion);
assert.equal(contract.source_semantic_owner, "Phase67C");
assert.equal(contract.source_experience_evidence_owner, "Phase77A");
assert.equal(contract.contested_schema_only, true);
assert.equal(contract.current_turn_counterevidence_required, true);
assert.equal(contract.semantic_rewrite_performed, false);
assert.equal(contract.specialized_schema_authored, false);
assert.equal(contract.durable_semantic_write_performed, false);
assert.equal(contract.future_refinement_owner, "Phase78B");

const baseWorld = {
  simulation_time: "2026-09-10T00:00:00.000Z",
  characters: { [character]: {} },
  memories: { [character]: [] },
};
const first = appendActionExperience(baseWorld, {
  turnId: "phase78a_support_001",
  sceneId: "training_room",
  actionId: "probe_first",
  action: "先用低風險動作試探對手",
  perceivedResult: "對手提前暴露防守傾向",
  perceivedStatus: "取得反應線索",
});
const second = appendActionExperience(first.world_state, {
  turnId: "phase78a_support_002",
  sceneId: "rooftop",
  actionId: "probe_second",
  action: "先製造小動靜觀察對手反應",
  perceivedResult: "對手注意力轉向聲音來源",
  perceivedStatus: "成功取得線索",
});
const formView = buildWorldSimulationPersonalSemanticMemoryResolverView({
  world_state: second.world_state,
  turn_id: "phase78a_support_002",
  source_organization_event_ids: [second.organization_event_id],
});
const formed = deriveSemantic(
  second.world_state,
  "phase78a_support_002",
  [second.organization_event_id],
  [{
    character,
    operation: "form",
    semantic_category: "recurring_event_pattern",
    semantic_key: "probe-before-commit",
    semantic_descriptor: descriptor,
    source_life_event_refs: [first.life_event_ref, second.life_event_ref],
    resolver_view_hash: formView.resolver_view_hash,
    source: "programmatic_personal_semantic_memory_resolver",
  }],
);
const semanticEvent = formed.result.result.derivation_events_created[0];
assert.ok(semanticEvent?.semantic_memory_id);

const noCounterEvidence = buildWorldSimulationContextualSchemaRefinementEvidenceView({
  world_state: formed.world_state,
  turn_id: "phase78a_support_002",
  source_organization_event_ids: [second.organization_event_id],
});
assert.equal(noCounterEvidence.refinement_candidate_count, 0);

const third = appendActionExperience(formed.world_state, {
  turnId: "phase78a_counter_003",
  sceneId: "narrow_corridor",
  actionId: "probe_third",
  action: "在狹窄通道中先製造動靜試探",
  perceivedResult: "對手立即鎖定了自己的位置",
  perceivedStatus: "試探暴露位置並帶來風險",
});
const counterView = buildWorldSimulationPersonalSemanticMemoryResolverView({
  world_state: third.world_state,
  turn_id: "phase78a_counter_003",
  source_organization_event_ids: [third.organization_event_id],
});
const countered = deriveSemantic(
  third.world_state,
  "phase78a_counter_003",
  [third.organization_event_id],
  [{
    character,
    operation: "counterevidence",
    semantic_category: "recurring_event_pattern",
    semantic_key: semanticEvent.semantic_key,
    semantic_memory_id: semanticEvent.semantic_memory_id,
    source_life_event_refs: [third.life_event_ref],
    resolver_view_hash: counterView.resolver_view_hash,
    source: "programmatic_personal_semantic_memory_resolver",
  }],
);
const effective = projectWorldSimulationEffectivePersonalSemanticMemories({
  world_state: countered.world_state,
}).memories_by_character[character][semanticEvent.semantic_memory_id];
assert.equal(effective.state, "contested");
assert.equal(effective.support_life_event_refs.length, 2);
assert.equal(effective.counterevidence_life_event_refs.length, 1);

const evidence = buildWorldSimulationContextualSchemaRefinementEvidenceView({
  world_state: countered.world_state,
  turn_id: "phase78a_counter_003",
  source_organization_event_ids: [third.organization_event_id],
});
assert.equal(evidence.version, worldSimulationContextualSchemaRefinementEvidenceVersion);
assert.equal(evidence.refinement_candidate_count, 1);
const candidate = evidence.resolver_view.refinement_candidates[0];
assert.equal(candidate.character, character);
assert.equal(candidate.source_schema.predicate, descriptor.predicate);
assert.equal(candidate.source_schema.object_ref, descriptor.object_ref);
assert.deepEqual(candidate.source_schema.qualifiers, [...descriptor.qualifiers].sort());
assert.equal(candidate.source_schema.knowledge_status, "contested");
assert.equal(candidate.supporting_evidence_count, 2);
assert.equal(candidate.counterexample_evidence_count, 1);
assert.equal(candidate.current_turn_counterexample_count, 1);
assert.equal(candidate.counterexample_experience_evidence[0].current_turn_counterexample, true);
assert.equal(candidate.refinement_not_authored_yet, true);
assert.equal(evidence.audit.semantic_rewrite_performed, false);
assert.equal(evidence.audit.specialized_schema_authored, false);
assert.equal(evidence.audit.same_turn_character_brain_feedback, false);
assert.equal(evidence.internal_lineage.length, 1);
assert.equal(evidence.internal_lineage[0].source_semantic_memory_id, semanticEvent.semantic_memory_id);

const publicSerialized = JSON.stringify(evidence.resolver_view);
for (const hidden of [
  semanticEvent.semantic_memory_id,
  semanticEvent.semantic_key,
  first.life_event_ref.life_event_id,
  second.life_event_ref.life_event_id,
  third.life_event_ref.life_event_id,
  first.organization_event_id,
  third.organization_event_id,
  "engine_hidden_phase78a_counter_003",
  "engine_hidden_cause_phase78a_counter_003",
]) {
  assert.equal(publicSerialized.includes(hidden), false, `Phase78A public view leaked ${hidden}`);
}
assert.equal(evidence.resolver_view.boundaries.semantic_memory_id_exposed, false);
assert.equal(evidence.resolver_view.boundaries.life_event_identity_exposed, false);
assert.equal(evidence.resolver_view.boundaries.semantic_rewrite_requested, false);
assert.equal(evidence.resolver_view.boundaries.specialized_schema_authoring_requested, false);
assert.equal(
  evidence.resolver_view.refinement_requirements.refinement_must_narrow_applicability_not_rewrite_history,
  true,
);

const loopSource = fs.readFileSync(
  new URL("../../server/src/world-simulation-loop-service.mjs", import.meta.url),
  "utf8",
);
const stateSource = fs.readFileSync(
  new URL("../../server/src/world-simulation-state-service.mjs", import.meta.url),
  "utf8",
);
assert.match(
  loopSource,
  /buildWorldSimulationContextualSchemaRefinementEvidenceView\(\{[\s\S]*?world_state:\s*experientialMethodSemanticRevisionMutationExecution\.next_world_state/,
  "Phase78A must run only after the legal Phase76G -> Phase67C semantic revision state is materialized.",
);
assert.match(
  loopSource,
  /contextual_schema_refinement_evidence:\s*cloneJson\(contextualSchemaRefinementEvidence\)/,
  "Phase78A evidence must be included in the committed turn payload.",
);
assert.match(
  stateSource,
  /contextual_schema_refinement_evidence:\s*input\.contextual_schema_refinement_evidence \?\? null/,
  "Phase78A evidence must be retained in committed world history.",
);

console.log("Phase78A contextual schema refinement evidence tests passed.");
