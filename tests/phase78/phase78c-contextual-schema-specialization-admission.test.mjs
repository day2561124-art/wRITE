import assert from "node:assert/strict";
import fs from "node:fs";

import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import {
  buildWorldSimulationChronologicalMutationQueue,
  executeWorldSimulationChronologicalMutationQueue,
} from "../../server/src/world-simulation-chronological-mutation-queue-service.mjs";
import { projectWorldSimulationPostOutcomeSubjectivePerception } from "../../server/src/world-simulation-post-outcome-subjective-perception-service.mjs";
import { bridgeWorldSimulationPostOutcomeSubjectiveExperienceToMemory } from "../../server/src/world-simulation-post-outcome-subjective-memory-bridge-service.mjs";
import { formWorldSimulationSubjectiveMemories } from "../../server/src/world-simulation-subjective-memory-formation-service.mjs";
import { buildWorldSimulationSubjectiveEpisodeSegmentations } from "../../server/src/world-simulation-subjective-episode-segmentation-service.mjs";
import { buildWorldSimulationAutobiographicalLifeEventOrganizations } from "../../server/src/world-simulation-autobiographical-life-event-service.mjs";
import {
  buildWorldSimulationPersonalSemanticMemoryDerivations,
  buildWorldSimulationPersonalSemanticMemoryResolverView,
  projectWorldSimulationEffectivePersonalSemanticMemories,
} from "../../server/src/world-simulation-personal-semantic-memory-service.mjs";
import { buildWorldSimulationContextualSchemaRefinementEvidenceView } from "../../server/src/world-simulation-contextual-schema-refinement-evidence-service.mjs";
import {
  buildWorldSimulationContextualSchemaSpecializationResolverView,
  projectWorldSimulationContextualSchemaSpecialization,
} from "../../server/src/world-simulation-contextual-schema-specialization-service.mjs";
import {
  buildWorldSimulationContextualSchemaSpecializationAdmissionContract,
  buildWorldSimulationContextualSchemaSpecializationAdmissionResolverView,
  projectWorldSimulationContextualSchemaSpecializationAdmission,
  worldSimulationContextualSchemaSpecializationAdmissionVersion,
} from "../../server/src/world-simulation-contextual-schema-specialization-admission-service.mjs";

const character = "伊萊亞斯・諾爾";
const baseDescriptor = {
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

function appendActionExperience(worldState, { turnId, sceneId, actionId, action, perceivedResult, perceivedStatus }) {
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
    event: { event_id: `event_${turnId}`, scene_id: sceneId, simulation_time: `${turnId}:simulation` },
    decision_packets: bridge.memory_formation_packets,
    encoding_decisions: [],
    episode_bindings: [],
  });
  const memory = formation.result.character_updates[0].memory_records[0];
  const memoryWorld = structuredClone(worldState);
  memoryWorld.memories ??= {};
  memoryWorld.memories[character] ??= [];
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

const contract = buildWorldSimulationContextualSchemaSpecializationAdmissionContract();
assert.equal(contract.phase, "Phase78C");
assert.equal(contract.version, worldSimulationContextualSchemaSpecializationAdmissionVersion);
assert.equal(contract.explicit_admit_or_skip_required, true);
assert.equal(contract.source_contested_state_preserved, true);
assert.equal(contract.phase67c_append_only_form_or_support_required, true);
assert.equal(contract.direct_durable_semantic_write_allowed, false);
assert.equal(contract.same_turn_character_brain_feedback_allowed, false);

const baseWorld = {
  simulation_time: "2026-09-10T00:00:00.000Z",
  characters: { [character]: {} },
  memories: { [character]: [] },
};
const first = appendActionExperience(baseWorld, {
  turnId: "phase78c_support_001",
  sceneId: "training_room",
  actionId: "probe_first",
  action: "先用低風險動作試探對手",
  perceivedResult: "對手提前暴露防守傾向",
  perceivedStatus: "取得反應線索",
});
const second = appendActionExperience(first.world_state, {
  turnId: "phase78c_support_002",
  sceneId: "rooftop",
  actionId: "probe_second",
  action: "先製造小動靜觀察對手反應",
  perceivedResult: "對手注意力轉向聲音來源",
  perceivedStatus: "成功取得線索",
});
const formView = buildWorldSimulationPersonalSemanticMemoryResolverView({
  world_state: second.world_state,
  turn_id: "phase78c_support_002",
  source_organization_event_ids: [second.organization_event_id],
});
const formed = deriveSemantic(second.world_state, "phase78c_support_002", [second.organization_event_id], [{
  character,
  operation: "form",
  semantic_category: "recurring_event_pattern",
  semantic_key: "probe-before-commit",
  semantic_descriptor: baseDescriptor,
  source_life_event_refs: [first.life_event_ref, second.life_event_ref],
  resolver_view_hash: formView.resolver_view_hash,
  source: "programmatic_personal_semantic_memory_resolver",
}]);
const sourceSemanticEvent = formed.result.result.derivation_events_created[0];

const third = appendActionExperience(formed.world_state, {
  turnId: "phase78c_counter_003",
  sceneId: "narrow_corridor",
  actionId: "probe_third",
  action: "在狹窄通道中先製造動靜試探",
  perceivedResult: "對手立即鎖定了自己的位置",
  perceivedStatus: "試探暴露位置並帶來風險",
});
const counterView = buildWorldSimulationPersonalSemanticMemoryResolverView({
  world_state: third.world_state,
  turn_id: "phase78c_counter_003",
  source_organization_event_ids: [third.organization_event_id],
});
const countered = deriveSemantic(third.world_state, "phase78c_counter_003", [third.organization_event_id], [{
  character,
  operation: "counterevidence",
  semantic_category: "recurring_event_pattern",
  semantic_key: sourceSemanticEvent.semantic_key,
  semantic_memory_id: sourceSemanticEvent.semantic_memory_id,
  source_life_event_refs: [third.life_event_ref],
  resolver_view_hash: counterView.resolver_view_hash,
  source: "programmatic_personal_semantic_memory_resolver",
}]);

const evidence = buildWorldSimulationContextualSchemaRefinementEvidenceView({
  world_state: countered.world_state,
  turn_id: "phase78c_counter_003",
  source_organization_event_ids: [third.organization_event_id],
});
assert.equal(evidence.refinement_candidate_count, 1);
const refinement = evidence.resolver_view.refinement_candidates[0];
const supportRef = refinement.supporting_experience_evidence[0].evidence_ref;
const counterRef = refinement.counterexample_experience_evidence.find(
  (item) => item.current_turn_counterexample === true,
).evidence_ref;
const specializationView = buildWorldSimulationContextualSchemaSpecializationResolverView({
  contextual_schema_refinement_evidence: evidence,
});
const specialization = projectWorldSimulationContextualSchemaSpecialization({
  contextual_schema_refinement_evidence: evidence,
  resolver_view_hash: specializationView.resolver_view_hash,
  specialization_proposals: [{
    refinement_candidate_ref: refinement.refinement_candidate_ref,
    narrowing_qualifiers: ["有安全撤離空間時"],
    contrast_groundings: [{
      qualifier: "有安全撤離空間時",
      supporting_evidence_refs: [supportRef],
      counterexample_evidence_refs: [counterRef],
    }],
  }],
});
assert.equal(specialization.proposal_count, 1);

const admissionView = buildWorldSimulationContextualSchemaSpecializationAdmissionResolverView({
  contextual_schema_refinement_evidence: evidence,
  contextual_schema_specialization: specialization,
});
assert.equal(admissionView.candidates.length, 1);
assert.equal(admissionView.boundaries.source_semantic_identity_exposed, false);
assert.equal(JSON.stringify(admissionView).includes(sourceSemanticEvent.semantic_memory_id), false);
const proposalRef = specialization.specialization_proposals[0].specialization_proposal_ref;
const admission = projectWorldSimulationContextualSchemaSpecializationAdmission({
  world_state: countered.world_state,
  contextual_schema_refinement_evidence: evidence,
  contextual_schema_specialization: specialization,
  resolver_view_hash: admissionView.resolver_view_hash,
  admission_decisions: [{ specialization_proposal_ref: proposalRef, decision: "admit" }],
});
assert.equal(admission.admission_decision_count, 1);
assert.equal(admission.emitted_phase67c_semantic_decision_count, 1);
assert.equal(admission.admissions[0].decision, "admit");
assert.equal(admission.admissions[0].phase67c_operation, "form");
assert.equal(admission.admissions[0].source_contested_state_preserved, true);
assert.equal(admission.audit.direct_durable_semantic_write_performed, false);
assert.equal(admission.audit.same_turn_character_brain_feedback, false);
assert.equal(admission.semantic_decisions[0].semantic_category, "recurring_event_pattern");
assert.deepEqual(
  admission.semantic_decisions[0].semantic_descriptor.qualifiers,
  ["資訊不足時", "可安全試探時", "有安全撤離空間時"].sort(),
);
assert.equal(new Set(admission.semantic_decisions[0].source_life_event_refs.map((ref) => ref.life_event_id)).size, 3);

const retained = deriveSemantic(
  countered.world_state,
  "phase78c_counter_003",
  [third.organization_event_id],
  admission.semantic_decisions,
);
const effective = projectWorldSimulationEffectivePersonalSemanticMemories({
  world_state: retained.world_state,
}).memories_by_character[character];
assert.equal(effective[sourceSemanticEvent.semantic_memory_id].state, "contested");
const specialized = Object.values(effective).find((item) =>
  item.semantic_key.startsWith("contextual_specialization:"));
assert.ok(specialized);
assert.notEqual(specialized.semantic_memory_id, sourceSemanticEvent.semantic_memory_id);
assert.equal(specialized.state, "supported");
assert.deepEqual(
  specialized.semantic_descriptor.qualifiers,
  ["資訊不足時", "可安全試探時", "有安全撤離空間時"].sort(),
);

const skip = projectWorldSimulationContextualSchemaSpecializationAdmission({
  world_state: countered.world_state,
  contextual_schema_refinement_evidence: evidence,
  contextual_schema_specialization: specialization,
  resolver_view_hash: admissionView.resolver_view_hash,
  admission_decisions: [{ specialization_proposal_ref: proposalRef, decision: "skip" }],
});
assert.equal(skip.emitted_phase67c_semantic_decision_count, 0);
assert.equal(skip.admissions[0].phase67c_operation, null);

const repeatAdmission = projectWorldSimulationContextualSchemaSpecializationAdmission({
  world_state: retained.world_state,
  contextual_schema_refinement_evidence: evidence,
  contextual_schema_specialization: specialization,
  resolver_view_hash: admissionView.resolver_view_hash,
  admission_decisions: [{ specialization_proposal_ref: proposalRef, decision: "admit" }],
});
assert.equal(repeatAdmission.emitted_phase67c_semantic_decision_count, 1);
assert.equal(repeatAdmission.admissions[0].phase67c_operation, "support");
assert.equal(repeatAdmission.admissions[0].exact_existing_specialized_identity_reused, true);
assert.equal(repeatAdmission.admissions[0].source_contested_state_preserved, true);

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
  /buildWorldSimulationContextualSchemaSpecializationAdmissionResolverView\(\{[\s\S]*?contextual_schema_specialization:\s*contextualSchemaSpecialization/,
  "Phase78C must consume the exact Phase78A/78B projections behind an explicit admission resolver view.",
);
assert.match(
  loopSource,
  /contextualSchemaSpecializationSemanticRetention[\s\S]*?buildWorldSimulationPersonalSemanticMemoryDerivations\(\{/,
  "Phase78C durable retention must reuse Phase67C instead of creating a parallel semantic store.",
);
assert.match(
  loopSource,
  /autobiographicalLifePeriodSourceSemanticDerivationEventIds[\s\S]*?contextualSchemaSpecializationSemanticRetention[\s\S]*?derivation_events_created/,
  "Phase78C retained semantics must remain visible to downstream autobiographical organization.",
);
assert.match(
  stateSource,
  /contextual_schema_specialization_admission_resolution:\s*input\.contextual_schema_specialization_admission_resolution \?\? null/,
  "Phase78C admission projection must be retained in committed history.",
);
assert.match(
  stateSource,
  /contextual_schema_specialization_semantic_retention:\s*input\.contextual_schema_specialization_semantic_retention \?\? null/,
  "Phase78C Phase67C retention result must be retained in committed history.",
);

console.log("Phase78C contextual schema specialization admission tests passed.");
