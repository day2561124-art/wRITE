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
import {
  buildWorldSimulationExperientialKnowledgeReentryResolverView,
  projectWorldSimulationExperientialKnowledgeReentry,
} from "../../server/src/world-simulation-experiential-knowledge-reentry-service.mjs";
import {
  buildWorldSimulationExperientialMethodTransferResolverView,
  projectWorldSimulationExperientialMethodTransfer,
} from "../../server/src/world-simulation-experiential-method-transfer-service.mjs";
import {
  buildWorldSimulationExperientialMethodCandidateAttributionResolverView,
  buildWorldSimulationSelectedExperientialMethodApplicationReceipts,
  projectWorldSimulationExperientialMethodCandidateAttribution,
} from "../../server/src/world-simulation-experiential-method-application-lineage-service.mjs";
import { buildWorldSimulationSubjectiveChoiceCommitmentReceipts } from "../../server/src/world-simulation-subjective-choice-commitment-receipt-service.mjs";
import {
  buildWorldSimulationExperientialMethodOutcomeCreditResolverContext,
  projectWorldSimulationExperientialMethodOutcomeCredit,
} from "../../server/src/world-simulation-experiential-method-outcome-credit-service.mjs";

const character = "伊萊亞斯・諾爾";
const parentDescriptor = {
  subject_scope: "self_autobiographical_experience",
  predicate: "先試探反應再決定主要手段",
  object_ref: "低成本試探後依觀察結果調整行動",
  qualifiers: ["資訊不足時", "可安全試探時"].sort(),
};
const specializedDescriptor = {
  ...parentDescriptor,
  qualifiers: ["資訊不足時", "可安全試探時", "有安全撤離空間時"].sort(),
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
  assert.equal(formation.result.created_memory_count, 1);
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
    memory,
    bridge,
    selected,
  };
}

function deriveSemantic(worldState, turnId, sourceOrganizationEventIds, decisions) {
  const derivation = buildWorldSimulationPersonalSemanticMemoryDerivations({
    world_state: worldState,
    turn_id: turnId,
    source_organization_event_ids: sourceOrganizationEventIds,
    semantic_decisions: decisions,
  });
  return {
    derivation,
    world_state: applyTransitions(
      worldState,
      derivation.result.preview_world_state,
      derivation.result.state_transitions,
      `${turnId}:personal_semantic_memory`,
    ),
  };
}

function semanticView(worldState, turnId, organizationEventIds) {
  return buildWorldSimulationPersonalSemanticMemoryResolverView({
    world_state: worldState,
    turn_id: turnId,
    source_organization_event_ids: organizationEventIds,
  });
}

const baseWorld = {
  simulation_time: "2026-09-10T03:40:00.000Z",
  characters: { [character]: {} },
  memories: { [character]: [] },
};
const first = appendActionExperience(baseWorld, {
  turnId: "phase78d_support_001",
  sceneId: "training_room",
  actionId: "probe_first",
  action: "先用低風險動作試探對手",
  perceivedResult: "對手提前暴露防守傾向",
  perceivedStatus: "取得反應線索",
});
const second = appendActionExperience(first.world_state, {
  turnId: "phase78d_support_002",
  sceneId: "rooftop",
  actionId: "probe_second",
  action: "先製造小動靜觀察對手反應",
  perceivedResult: "對手注意力轉向聲音來源",
  perceivedStatus: "成功取得線索",
});
const formView = semanticView(second.world_state, "phase78d_support_002", [second.organization_event_id]);
const formedParent = deriveSemantic(second.world_state, "phase78d_support_002", [second.organization_event_id], [{
  character,
  operation: "form",
  semantic_category: "recurring_event_pattern",
  semantic_key: "probe-before-commit",
  semantic_descriptor: parentDescriptor,
  source_life_event_refs: [first.life_event_ref, second.life_event_ref],
  resolver_view_hash: formView.resolver_view_hash,
  source: "programmatic_personal_semantic_memory_resolver",
}]);
const parentEvent = formedParent.derivation.result.derivation_events_created[0];

const third = appendActionExperience(formedParent.world_state, {
  turnId: "phase78d_counter_003",
  sceneId: "narrow_corridor",
  actionId: "probe_third",
  action: "在狹窄通道中先製造動靜試探",
  perceivedResult: "對手立即鎖定了自己的位置",
  perceivedStatus: "試探暴露位置並帶來風險",
});
const counterView = semanticView(third.world_state, "phase78d_counter_003", [third.organization_event_id]);
const contestedParent = deriveSemantic(third.world_state, "phase78d_counter_003", [third.organization_event_id], [{
  character,
  operation: "counterevidence",
  semantic_category: "recurring_event_pattern",
  semantic_key: parentEvent.semantic_key,
  semantic_memory_id: parentEvent.semantic_memory_id,
  source_life_event_refs: [third.life_event_ref],
  resolver_view_hash: counterView.resolver_view_hash,
  source: "programmatic_personal_semantic_memory_resolver",
}]);

// Phase78C's durable product is an ordinary Phase67C recurring-event semantic
// with a strict superset of the contested parent qualifiers and a distinct
// contextual_specialization identity. Phase78C itself already verifies the
// exact Phase78A/78B admission lineage; this closure test starts from that
// durable shape and proves the existing Phase76D-G loop can reuse it later.
const specializedKey = `contextual_specialization:${hashAgentRunValue(specializedDescriptor).slice(0, 40)}`;
const specializedView = semanticView(contestedParent.world_state, "phase78d_counter_003", [third.organization_event_id]);
const retainedSpecialization = deriveSemantic(
  contestedParent.world_state,
  "phase78d_counter_003",
  [third.organization_event_id],
  [{
    character,
    operation: "form",
    semantic_category: "recurring_event_pattern",
    semantic_key: specializedKey,
    semantic_descriptor: specializedDescriptor,
    source_life_event_refs: [first.life_event_ref, second.life_event_ref, third.life_event_ref],
    resolver_view_hash: specializedView.resolver_view_hash,
    source: "programmatic_personal_semantic_memory_resolver",
  }],
);
const specializedEvent = retainedSpecialization.derivation.result.derivation_events_created[0];
assert.notEqual(specializedEvent.semantic_memory_id, parentEvent.semantic_memory_id);

let effective = projectWorldSimulationEffectivePersonalSemanticMemories({
  world_state: retainedSpecialization.world_state,
}).memories_by_character[character];
assert.equal(effective[parentEvent.semantic_memory_id].state, "contested");
assert.equal(effective[specializedEvent.semantic_memory_id].state, "supported");
assert.deepEqual(effective[specializedEvent.semantic_memory_id].semantic_descriptor, specializedDescriptor);

const sameTurnReentry = buildWorldSimulationExperientialKnowledgeReentryResolverView({
  world_state: retainedSpecialization.world_state,
  character,
  current_turn_id: "phase78d_counter_003",
  current_context: { current_goal: "完成當前訓練" },
});
assert.equal(
  sameTurnReentry.candidate_personal_semantics.some((item) => item.semantic_ref === specializedEvent.semantic_memory_id),
  false,
  "A newly retained Phase78C specialization must not feed back through Phase76D in the same turn.",
);

const fourth = appendActionExperience(retainedSpecialization.world_state, {
  turnId: "phase78d_reuse_004",
  sceneId: "open_training_yard",
  actionId: "safe_probe_then_adapt",
  action: "在有撤離空間的訓練場先低成本試探，再依反應調整主要手段",
  perceivedResult: "對手暴露防守重心，自己仍保有安全撤離路線",
  perceivedStatus: "取得線索且保持安全",
});
const currentContext = {
  perception: { observed: [{ description: "資訊不足，但目前場地有安全撤離空間。" }] },
  current_goal: "安全取得對手反應線索後再決定主要手段",
};
const reentryView = buildWorldSimulationExperientialKnowledgeReentryResolverView({
  world_state: fourth.world_state,
  character,
  current_turn_id: "phase78d_reuse_004",
  current_context: currentContext,
});
const specializedCandidate = reentryView.candidate_personal_semantics.find(
  (item) => item.semantic_ref === specializedEvent.semantic_memory_id,
);
assert.ok(specializedCandidate, "The exact Phase78C specialized semantic must re-enter on a later turn.");
assert.equal(specializedCandidate.semantic_category, "recurring_event_pattern");
assert.equal(specializedCandidate.knowledge_status, "supported");
assert.deepEqual(specializedCandidate.semantic_descriptor, specializedDescriptor);
assert.equal(
  specializedCandidate.semantic_descriptor.qualifiers.includes("有安全撤離空間時"),
  true,
  "The narrowing qualifier must survive durable retention and later-turn re-entry.",
);

const reentry = projectWorldSimulationExperientialKnowledgeReentry({
  resolver_view: reentryView,
  activated_semantic_refs: [specializedCandidate.semantic_ref],
});
const transferView = buildWorldSimulationExperientialMethodTransferResolverView({
  character,
  current_turn_id: "phase78d_reuse_004",
  experiential_knowledge_reentry: reentry,
  current_context: currentContext,
});
assert.equal(transferView.method_candidates.length, 1);
assert.deepEqual(transferView.method_candidates[0].method_skeleton.qualifiers, specializedDescriptor.qualifiers);
const transfer = projectWorldSimulationExperientialMethodTransfer({
  resolver_view: transferView,
  transfer_mappings: [{
    transfer_ref: transferView.method_candidates[0].transfer_ref,
    mapping_kind: "structural_match",
    current_cue_refs: transferView.current_cue_catalog.map((cue) => cue.cue_ref),
  }],
});
assert.deepEqual(
  transfer.character_view.transferred_methods[0].method_skeleton.qualifiers,
  specializedDescriptor.qualifiers,
);

const candidateActions = [{
  action_id: "safe_probe_then_adapt",
  intent: "在有撤離空間的訓練場先低成本試探，再依反應調整主要手段",
  prerequisites: ["存在安全撤離空間"],
  known_costs: ["暫緩主要攻勢"],
}];
const cognition = {
  experiential_method_guidance: transfer.character_view,
  current_action: "觀察對手防守",
};
const attributionView = buildWorldSimulationExperientialMethodCandidateAttributionResolverView({
  character,
  current_turn_id: "phase78d_reuse_004",
  experiential_method_transfer: transfer,
  cognition,
  candidate_action_intents: candidateActions,
});
const attribution = projectWorldSimulationExperientialMethodCandidateAttribution({
  resolver_view: attributionView,
  candidate_attributions: [{
    transfer_ref: attributionView.method_catalog[0].transfer_ref,
    action_ref: attributionView.action_catalog[0].action_ref,
  }],
});
assert.equal(attribution.candidate_attributions.length, 1);

const worldStateHash = hashAgentRunValue(fourth.world_state);
const choices = buildWorldSimulationSubjectiveChoiceCommitmentReceipts({
  world_simulation_session_id: "phase78d_world_session",
  turn_id: "phase78d_reuse_004",
  state_revision: 12,
  world_state_hash: worldStateHash,
  decision_packets: [{ character, cognition, candidate_action_intents: candidateActions }],
  selected_action_intents: [{
    character,
    selection: "candidate_action_intent",
    action_id: candidateActions[0].action_id,
    intent: candidateActions[0].intent,
  }],
});
const selectedApplications = buildWorldSimulationSelectedExperientialMethodApplicationReceipts({
  world_simulation_session_id: "phase78d_world_session",
  turn_id: "phase78d_reuse_004",
  state_revision: 12,
  world_state_hash: worldStateHash,
  candidate_attribution_projections: [attribution],
  subjective_choice_commitment_receipts: choices,
});
assert.equal(selectedApplications.receipt_count, 1);

const outcomeContext = buildWorldSimulationExperientialMethodOutcomeCreditResolverContext({
  world_state: fourth.world_state,
  turn_id: "phase78d_reuse_004",
  selected_application_receipts: selectedApplications,
  phase76b_memory_bridge: fourth.bridge,
  source_memory_records: [{ character, memory_record: fourth.memory }],
  source_organization_event_ids: [fourth.organization_event_id],
  experiential_knowledge_reentry_projections: [reentry],
  experiential_method_transfer_projections: [transfer],
});
assert.equal(outcomeContext.resolver_view.applications.length, 1);
assert.equal(outcomeContext.resolver_view.applications[0].assessment_eligible, true);
assert.equal(outcomeContext.resolver_view.applications[0].semantic_revision_currently_eligible, true);
const applicationRef = outcomeContext.resolver_view.applications[0].application_ref;

const support = projectWorldSimulationExperientialMethodOutcomeCredit({
  resolver_context: outcomeContext,
  assessment_decisions: [{ application_ref: applicationRef, assessment: "supports_prior_method" }],
});
assert.equal(support.semantic_decision_count, 1);
assert.equal(support.semantic_decisions[0].semantic_memory_id, specializedEvent.semantic_memory_id);
assert.equal(support.semantic_decisions[0].operation, "support");
const supportedSpecialization = deriveSemantic(
  fourth.world_state,
  "phase78d_reuse_004",
  [fourth.organization_event_id],
  support.semantic_decisions,
);
effective = projectWorldSimulationEffectivePersonalSemanticMemories({
  world_state: supportedSpecialization.world_state,
}).memories_by_character[character];
assert.equal(effective[parentEvent.semantic_memory_id].state, "contested");
assert.equal(effective[parentEvent.semantic_memory_id].counterevidence_life_event_refs.length, 1);
assert.equal(effective[specializedEvent.semantic_memory_id].state, "supported");
assert.equal(effective[specializedEvent.semantic_memory_id].support_life_event_refs.length, 4);
assert.deepEqual(effective[specializedEvent.semantic_memory_id].semantic_descriptor, specializedDescriptor);

const counter = projectWorldSimulationExperientialMethodOutcomeCredit({
  resolver_context: outcomeContext,
  assessment_decisions: [{ application_ref: applicationRef, assessment: "counterevidence_for_prior_method" }],
});
assert.equal(counter.semantic_decision_count, 1);
assert.equal(counter.semantic_decisions[0].semantic_memory_id, specializedEvent.semantic_memory_id);
assert.equal(counter.semantic_decisions[0].operation, "counterevidence");
const counteredSpecialization = deriveSemantic(
  fourth.world_state,
  "phase78d_reuse_004",
  [fourth.organization_event_id],
  counter.semantic_decisions,
);
effective = projectWorldSimulationEffectivePersonalSemanticMemories({
  world_state: counteredSpecialization.world_state,
}).memories_by_character[character];
assert.equal(effective[parentEvent.semantic_memory_id].state, "contested");
assert.equal(effective[parentEvent.semantic_memory_id].counterevidence_life_event_refs.length, 1);
assert.equal(effective[specializedEvent.semantic_memory_id].state, "contested");
assert.equal(effective[specializedEvent.semantic_memory_id].counterevidence_life_event_refs.length, 1);
assert.deepEqual(effective[specializedEvent.semantic_memory_id].semantic_descriptor, specializedDescriptor);

const loopSource = fs.readFileSync(
  new URL("../../server/src/world-simulation-loop-service.mjs", import.meta.url),
  "utf8",
);
const reentryIndex = loopSource.indexOf("const experientialKnowledgeReentryResolverView =");
const specializationRetentionIndex = loopSource.indexOf("const contextualSchemaSpecializationSemanticRetention =");
assert.ok(
  reentryIndex >= 0 && specializationRetentionIndex > reentryIndex,
  "Committed prior-turn Phase76D re-entry must precede current-turn Phase78C retention, preventing same-turn specialization feedback.",
);

console.log("Phase78D cross-turn contextual specialization reuse and revision closure tests passed.");
