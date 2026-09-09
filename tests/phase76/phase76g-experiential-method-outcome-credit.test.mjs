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
  projectWorldSimulationPostOutcomeSubjectivePerception,
} from "../../server/src/world-simulation-post-outcome-subjective-perception-service.mjs";
import {
  bridgeWorldSimulationPostOutcomeSubjectiveExperienceToMemory,
} from "../../server/src/world-simulation-post-outcome-subjective-memory-bridge-service.mjs";
import {
  formWorldSimulationSubjectiveMemories,
} from "../../server/src/world-simulation-subjective-memory-formation-service.mjs";
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
import {
  buildWorldSimulationSubjectiveChoiceCommitmentReceipts,
} from "../../server/src/world-simulation-subjective-choice-commitment-receipt-service.mjs";
import {
  buildWorldSimulationExperientialMethodOutcomeCreditContract,
  buildWorldSimulationExperientialMethodOutcomeCreditResolverContext,
  projectWorldSimulationExperientialMethodOutcomeCredit,
  worldSimulationExperientialMethodOutcomeCreditVersion,
} from "../../server/src/world-simulation-experiential-method-outcome-credit-service.mjs";
import {
  buildWorldSimulationLoopContract,
} from "../../server/src/world-simulation-loop-service.mjs";

const character = "伊萊亞斯・諾爾";
const semanticDescriptor = {
  subject_scope: "self_autobiographical_experience",
  predicate: "when_direct_route_blocked_seek_alternative_route",
  object_ref: "alternative-route-method",
  qualifiers: ["alternative-means", "blocked-route"],
};

function directMemory({ memoryId, turnId, sceneId, description }) {
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

function segment(worldState, turnId, memoryRecord) {
  const result = buildWorldSimulationSubjectiveEpisodeSegmentations({
    world_state: worldState,
    turn_id: turnId,
    source_memory_records: [{ character, memory_record: memoryRecord }],
  });
  return {
    result,
    world_state: applyTransitions(
      worldState,
      result.result.preview_world_state,
      result.result.state_transitions,
      `${turnId}:subjective_episode_segmentation`,
    ),
    ids: [
      ...result.result.segmentation_events_created.map((event) => event.segmentation_event_id),
      ...result.result.already_persisted_segmentation_event_ids,
    ],
  };
}

function organizeLifeEvent(worldState, turnId, segmentationIds) {
  const result = buildWorldSimulationAutobiographicalLifeEventOrganizations({
    world_state: worldState,
    turn_id: turnId,
    source_segmentation_event_ids: segmentationIds,
    organization_decisions: [],
  });
  return {
    result,
    world_state: applyTransitions(
      worldState,
      result.result.preview_world_state,
      result.result.state_transitions,
      `${turnId}:autobiographical_life_event`,
    ),
    ids: result.result.organization_events_created.map((event) => event.organization_event_id),
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

function deriveSemantic(worldState, turnId, organizationIds, decisions) {
  const result = buildWorldSimulationPersonalSemanticMemoryDerivations({
    world_state: worldState,
    turn_id: turnId,
    source_organization_event_ids: organizationIds,
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

function makePriorSemanticState() {
  const turn1 = "phase76g_prior_001";
  const memory1 = directMemory({
    memoryId: "phase76g_prior_memory_001",
    turnId: turn1,
    sceneId: "blocked_gate_001",
    description: "主要通道受阻後，改找另一條路。",
  });
  let state = {
    simulation_time: "2026-09-09T09:00:00.000Z",
    characters: { [character]: {} },
    memories: { [character]: [memory1] },
  };
  const seg1 = segment(state, turn1, memory1);
  const life1 = organizeLifeEvent(seg1.world_state, turn1, seg1.ids);

  const turn2 = "phase76g_prior_002";
  const memory2 = directMemory({
    memoryId: "phase76g_prior_memory_002",
    turnId: turn2,
    sceneId: "blocked_gate_002",
    description: "第二次遇到主路受阻時，也改找替代路徑。",
  });
  state = structuredClone(life1.world_state);
  state.memories[character].push(memory2);
  const seg2 = segment(state, turn2, memory2);
  const life2 = organizeLifeEvent(seg2.world_state, turn2, seg2.ids);
  const resolverView = buildWorldSimulationPersonalSemanticMemoryResolverView({
    world_state: life2.world_state,
    turn_id: turn2,
    source_organization_event_ids: life2.ids,
  });
  const semantic = deriveSemantic(
    life2.world_state,
    turn2,
    life2.ids,
    [{
      character,
      operation: "form",
      semantic_category: "recurring_event_pattern",
      semantic_key: "blocked-route-seek-alternative",
      semantic_descriptor: semanticDescriptor,
      source_life_event_refs: [
        lifeEventRef(life2.world_state, life1.ids[0]),
        lifeEventRef(life2.world_state, life2.ids[0]),
      ],
      resolver_view_hash: resolverView.resolver_view_hash,
      source: "programmatic_personal_semantic_memory_resolver",
    }],
  );
  const event = semantic.result.result.derivation_events_created[0];
  assert.ok(event?.semantic_memory_id);
  return {
    world_state: semantic.world_state,
    semantic_memory_id: event.semantic_memory_id,
    semantic_key: event.semantic_key,
  };
}

function currentApplicationFixture(prior, {
  turnId = "phase76g_current_001",
  performed = true,
  perceivedResult = "找到能繞過坍方的側路",
  perceivedStatus = "可繼續前進",
} = {}) {
  const actionId = "search_alternative_passage";
  const actionIntent = "檢���坍方周圍是否有能繞行的其他通路";
  const selected = [{
    character,
    selection: "candidate_action_intent",
    action_id: actionId,
    intent: actionIntent,
  }];
  const phase76a = projectWorldSimulationPostOutcomeSubjectivePerception({
    turn_id: turnId,
    selected_action_intents: selected,
    action_outcomes: [{
      actor: character,
      action_id: actionId,
      result: "engine_private_outcome_should_not_leak",
      causal_evidence: "engine_private_causal_evidence_should_not_leak",
      character_experience: {
        performed,
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
  const event = {
    event_id: `${turnId}:event`,
    scene_id: "collapsed_cave_passage",
    simulation_time: "2026-09-09T10:00:00.000Z",
  };
  const formation = formWorldSimulationSubjectiveMemories({
    world_state: prior.world_state,
    turn_id: turnId,
    event,
    decision_packets: bridge.memory_formation_packets,
    encoding_decisions: [],
    episode_bindings: [],
  });
  const currentMemory = formation.result.character_updates[0].memory_records[0];
  let state = structuredClone(prior.world_state);
  state.memories[character].push(structuredClone(currentMemory));
  const segmented = segment(state, turnId, currentMemory);
  const life = organizeLifeEvent(segmented.world_state, turnId, segmented.ids);
  assert.equal(life.ids.length, 1, "Phase76G fixture requires one fresh current LifeEvent organization event.");

  const reentryView = buildWorldSimulationExperientialKnowledgeReentryResolverView({
    world_state: life.world_state,
    character,
    current_turn_id: turnId,
    current_context: {
      perception: { observed: [{ description: "山洞主通道被坍方堵住。" }] },
      current_goal: "抵達山洞深處",
    },
  });
  const reentryCandidate = reentryView.candidate_personal_semantics
    .find((candidate) => candidate.semantic_ref === prior.semantic_memory_id);
  assert.ok(reentryCandidate, "Phase76D must expose the prior experiential semantic as an opaque candidate.");
  const reentry = projectWorldSimulationExperientialKnowledgeReentry({
    resolver_view: reentryView,
    activated_semantic_refs: [reentryCandidate.semantic_ref],
  });
  const transferView = buildWorldSimulationExperientialMethodTransferResolverView({
    character,
    current_turn_id: turnId,
    experiential_knowledge_reentry: reentry,
    current_context: {
      perception: { observed: [{ description: "山洞主通道被坍方堵住。" }] },
      current_goal: "抵達山洞深處",
    },
  });
  assert.equal(transferView.method_candidates.length, 1);
  const transfer = projectWorldSimulationExperientialMethodTransfer({
    resolver_view: transferView,
    transfer_mappings: [{
      transfer_ref: transferView.method_candidates[0].transfer_ref,
      mapping_kind: "structural_match",
      current_cue_refs: transferView.current_cue_catalog.map((cue) => cue.cue_ref),
    }],
  });
  const candidateActions = [{
    action_id: actionId,
    intent: actionIntent,
    prerequisites: ["能觀察周圍"],
    known_costs: ["花費時間"],
  }];
  const cognition = {
    experiential_method_guidance: transfer.character_view,
    current_action: "評估坍方",
  };
  const attributionView =
    buildWorldSimulationExperientialMethodCandidateAttributionResolverView({
      character,
      current_turn_id: turnId,
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
  const worldStateHash = hashAgentRunValue(life.world_state);
  const decisionPacket = { character, cognition, candidate_action_intents: candidateActions };
  const choiceBundle = buildWorldSimulationSubjectiveChoiceCommitmentReceipts({
    world_simulation_session_id: "phase76g_world_session",
    turn_id: turnId,
    state_revision: 7,
    world_state_hash: worldStateHash,
    decision_packets: [decisionPacket],
    selected_action_intents: selected,
  });
  const selectedApplications =
    buildWorldSimulationSelectedExperientialMethodApplicationReceipts({
      world_simulation_session_id: "phase76g_world_session",
      turn_id: turnId,
      state_revision: 7,
      world_state_hash: worldStateHash,
      candidate_attribution_projections: [attribution],
      subjective_choice_commitment_receipts: choiceBundle,
    });
  assert.equal(selectedApplications.receipt_count, 1);
  return {
    turn_id: turnId,
    world_state: life.world_state,
    current_memory: currentMemory,
    source_organization_event_ids: life.ids,
    phase76a,
    bridge,
    reentry,
    transfer,
    selected_applications: selectedApplications,
  };
}

function rebuildReceiptBundleWithSecondMethod(bundle) {
  const next = structuredClone(bundle);
  const receipt = next.receipts[0];
  receipt.applied_method_refs = [
    ...receipt.applied_method_refs,
    "phase76e_method_second_ambiguous_source",
  ].sort();
  receipt.candidate_attribution_refs = [
    ...receipt.candidate_attribution_refs,
    "phase76f_candidate_second_ambiguous_source",
  ].sort();
  const identity = {
    version: receipt.version,
    world_simulation_session_id: receipt.world_simulation_session_id,
    turn_id: receipt.turn_id,
    state_revision: receipt.state_revision,
    world_state_hash: receipt.world_state_hash,
    character: receipt.character,
    selection_kind: receipt.selection_kind,
    action_id: receipt.action_id,
    action_ref: receipt.action_ref,
    phase74d_choice_receipt_id: receipt.phase74d_choice_receipt_id,
    phase74d_choice_receipt_hash: receipt.phase74d_choice_receipt_hash,
    source_phase76f_projection_hash: receipt.source_phase76f_projection_hash,
    source_phase76e_transfer_hash: receipt.source_phase76e_transfer_hash,
    candidate_attribution_refs: receipt.candidate_attribution_refs,
    applied_method_refs: receipt.applied_method_refs,
  };
  receipt.receipt_hash = hashAgentRunValue(identity);
  receipt.receipt_id = `phase76f_application_${receipt.receipt_hash.slice(0, 24)}`;
  delete next.receipt_bundle_hash;
  next.receipt_bundle_hash = hashAgentRunValue(next);
  return next;
}

const contract = buildWorldSimulationExperientialMethodOutcomeCreditContract();
assert.equal(contract.phase, "Phase76G");
assert.equal(contract.version, worldSimulationExperientialMethodOutcomeCreditVersion);
assert.equal(contract.source_application_owner, "Phase76F");
assert.equal(contract.durable_semantic_revision_owner, "Phase67C");
assert.equal(contract.single_applied_method_required_for_credit, true);
assert.equal(contract.multiple_applied_methods_are_ambiguous, true);
assert.equal(contract.performed_true_required_for_support_or_counterevidence, true);
assert.equal(contract.same_semantic_second_revision_in_same_turn_allowed, false);
assert.equal(contract.successful_action_auto_credits_method, false);
assert.equal(contract.failed_action_auto_discredits_method, false);
assert.equal(contract.numeric_reward_q_value_success_rate_modeled, false);
assert.equal(contract.second_phase67c_append_only_pass_reused, true);
assert.equal(contract.parallel_semantic_memory_store_created, false);
assert.equal(contract.same_turn_character_brain_feedback_allowed, false);

const prior = makePriorSemanticState();
const fixture = currentApplicationFixture(prior);
const context = buildWorldSimulationExperientialMethodOutcomeCreditResolverContext({
  world_state: fixture.world_state,
  turn_id: fixture.turn_id,
  selected_application_receipts: fixture.selected_applications,
  phase76b_memory_bridge: fixture.bridge,
  source_memory_records: [{ character, memory_record: fixture.current_memory }],
  source_organization_event_ids: fixture.source_organization_event_ids,
  experiential_knowledge_reentry_projections: [fixture.reentry],
  experiential_method_transfer_projections: [fixture.transfer],
});
assert.equal(context.version, worldSimulationExperientialMethodOutcomeCreditVersion);
assert.equal(context.resolver_view.applications.length, 1);
const application = context.resolver_view.applications[0];
assert.equal(application.assessment_eligible, true);
assert.equal(application.semantic_revision_currently_eligible, true);
assert.equal(application.subjective_experience.performed, true);
assert.equal(application.subjective_experience.perceived_result, "找到能繞過坍方的側路");
assert.equal(application.method_skeleton.relation, semanticDescriptor.predicate);
assert.equal(application.method_skeleton.method_ref, semanticDescriptor.object_ref);
assert.deepEqual(application.ambiguity_reasons, []);
const serializedResolverView = JSON.stringify(context.resolver_view);
assert.equal(serializedResolverView.includes(prior.semantic_memory_id), false);
assert.equal(serializedResolverView.includes(fixture.source_organization_event_ids[0]), false);
assert.equal(serializedResolverView.includes("engine_private_outcome_should_not_leak"), false);
assert.equal(serializedResolverView.includes("engine_private_causal_evidence_should_not_leak"), false);

const noAutomaticCredit = projectWorldSimulationExperientialMethodOutcomeCredit({
  resolver_context: context,
  assessment_decisions: [],
});
assert.equal(noAutomaticCredit.assessment_count, 0);
assert.equal(noAutomaticCredit.semantic_decision_count, 0);
assert.equal(noAutomaticCredit.audit.success_auto_credits_method, false);
assert.equal(noAutomaticCredit.audit.failure_auto_discredits_method, false);

const supported = projectWorldSimulationExperientialMethodOutcomeCredit({
  resolver_context: context,
  assessment_decisions: [{
    application_ref: application.application_ref,
    assessment: "supports_prior_method",
  }],
});
assert.equal(supported.assessment_count, 1);
assert.equal(supported.semantic_decision_count, 1);
assert.equal(supported.assessments[0].objective_causation_claimed, false);
assert.equal(supported.assessments[0].numeric_credit_assigned, false);
assert.equal(supported.semantic_decisions[0].operation, "support");
assert.equal(supported.semantic_decisions[0].semantic_memory_id, prior.semantic_memory_id);
assert.equal(supported.semantic_decisions[0].source_life_event_refs.length, 1);

const retained = deriveSemantic(
  fixture.world_state,
  fixture.turn_id,
  fixture.source_organization_event_ids,
  supported.semantic_decisions,
);
const supportEvent = retained.result.result.derivation_events_created[0];
assert.equal(supportEvent.operation, "support");
assert.equal(supportEvent.semantic_memory_id, prior.semantic_memory_id);
assert.equal(supportEvent.derivation_evidence.eager_semanticization_used, false);
assert.equal(supportEvent.epistemic_acceptance_decided, false);
assert.equal(supportEvent.belief_engine_used, false);
let effective = projectWorldSimulationEffectivePersonalSemanticMemories({
  world_state: retained.world_state,
}).memories_by_character[character][prior.semantic_memory_id];
assert.equal(effective.state, "supported");
assert.equal(effective.support_life_event_refs.length, 3);
assert.equal(effective.counterevidence_life_event_refs.length, 0);

// If ordinary/current-turn Phase67C has already updated the same semantic,
// Phase76G must not append a second potentially contradictory revision in the
// same turn. It remains assessable, but durable revise/retain is deferred.
const alreadyRevisedContext =
  buildWorldSimulationExperientialMethodOutcomeCreditResolverContext({
    world_state: retained.world_state,
    turn_id: fixture.turn_id,
    selected_application_receipts: fixture.selected_applications,
    phase76b_memory_bridge: fixture.bridge,
    source_memory_records: [{ character, memory_record: fixture.current_memory }],
    source_organization_event_ids: fixture.source_organization_event_ids,
    experiential_knowledge_reentry_projections: [fixture.reentry],
    experiential_method_transfer_projections: [fixture.transfer],
  });
const alreadyRevisedApplication = alreadyRevisedContext.resolver_view.applications[0];
assert.equal(alreadyRevisedApplication.assessment_eligible, true);
assert.equal(alreadyRevisedApplication.semantic_revision_currently_eligible, false);
assert.ok(alreadyRevisedApplication.ambiguity_reasons.includes(
  "source_semantic_already_revised_this_turn",
));
assert.throws(
  () => projectWorldSimulationExperientialMethodOutcomeCredit({
    resolver_context: alreadyRevisedContext,
    assessment_decisions: [{
      application_ref: alreadyRevisedApplication.application_ref,
      assessment: "counterevidence_for_prior_method",
    }],
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_EXPERIENTIAL_METHOD_OUTCOME_CREDIT_REVISION_NOT_ELIGIBLE",
);
const alreadyRevisedAmbiguous = projectWorldSimulationExperientialMethodOutcomeCredit({
  resolver_context: alreadyRevisedContext,
  assessment_decisions: [{
    application_ref: alreadyRevisedApplication.application_ref,
    assessment: "ambiguous_no_revision",
  }],
});
assert.equal(alreadyRevisedAmbiguous.semantic_decision_count, 0);

const counter = projectWorldSimulationExperientialMethodOutcomeCredit({
  resolver_context: context,
  assessment_decisions: [{
    application_ref: application.application_ref,
    assessment: "counterevidence_for_prior_method",
  }],
});
assert.equal(counter.semantic_decisions[0].operation, "counterevidence");
const revised = deriveSemantic(
  fixture.world_state,
  fixture.turn_id,
  fixture.source_organization_event_ids,
  counter.semantic_decisions,
);
effective = projectWorldSimulationEffectivePersonalSemanticMemories({
  world_state: revised.world_state,
}).memories_by_character[character][prior.semantic_memory_id];
assert.equal(effective.state, "contested");
assert.equal(effective.counterevidence_life_event_refs.length, 1);
assert.equal(effective.epistemic_acceptance_decided, false);
assert.equal(effective.confidence, null);
assert.equal(effective.probability, null);

assert.throws(
  () => projectWorldSimulationExperientialMethodOutcomeCredit({
    resolver_context: context,
    assessment_decisions: [{
      application_ref: application.application_ref,
      assessment: "supports_prior_method",
      reward: 1,
    }],
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_EXPERIENTIAL_METHOD_OUTCOME_CREDIT_AUTHORITY_FIELD_FORBIDDEN",
);
assert.throws(
  () => projectWorldSimulationExperientialMethodOutcomeCredit({
    resolver_context: context,
    assessment_decisions: [{
      application_ref: "phase76g_application_not_in_view",
      assessment: "supports_prior_method",
    }],
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_EXPERIENTIAL_METHOD_OUTCOME_CREDIT_APPLICATION_OUT_OF_VIEW",
);

const ambiguousBundle = rebuildReceiptBundleWithSecondMethod(
  fixture.selected_applications,
);
const ambiguousContext = buildWorldSimulationExperientialMethodOutcomeCreditResolverContext({
  world_state: fixture.world_state,
  turn_id: fixture.turn_id,
  selected_application_receipts: ambiguousBundle,
  phase76b_memory_bridge: fixture.bridge,
  source_memory_records: [{ character, memory_record: fixture.current_memory }],
  source_organization_event_ids: fixture.source_organization_event_ids,
  experiential_knowledge_reentry_projections: [fixture.reentry],
  experiential_method_transfer_projections: [fixture.transfer],
});
const ambiguousApplication = ambiguousContext.resolver_view.applications[0];
assert.equal(ambiguousApplication.assessment_eligible, false);
assert.ok(ambiguousApplication.ambiguity_reasons.includes(
  "multiple_methods_attributed_to_selected_candidate",
));
assert.throws(
  () => projectWorldSimulationExperientialMethodOutcomeCredit({
    resolver_context: ambiguousContext,
    assessment_decisions: [{
      application_ref: ambiguousApplication.application_ref,
      assessment: "supports_prior_method",
    }],
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_EXPERIENTIAL_METHOD_OUTCOME_CREDIT_REVISION_NOT_ELIGIBLE",
);
const ambiguous = projectWorldSimulationExperientialMethodOutcomeCredit({
  resolver_context: ambiguousContext,
  assessment_decisions: [{
    application_ref: ambiguousApplication.application_ref,
    assessment: "ambiguous_no_revision",
  }],
});
assert.equal(ambiguous.semantic_decision_count, 0);
assert.equal(ambiguous.assessments[0].semantic_revision_emitted, false);

const notPerformedFixture = currentApplicationFixture(prior, {
  turnId: "phase76g_current_not_performed",
  performed: false,
  perceivedResult: "沒有真正開始搜尋",
  perceivedStatus: "未執行",
});
const notPerformedContext = buildWorldSimulationExperientialMethodOutcomeCreditResolverContext({
  world_state: notPerformedFixture.world_state,
  turn_id: notPerformedFixture.turn_id,
  selected_application_receipts: notPerformedFixture.selected_applications,
  phase76b_memory_bridge: notPerformedFixture.bridge,
  source_memory_records: [{ character, memory_record: notPerformedFixture.current_memory }],
  source_organization_event_ids: notPerformedFixture.source_organization_event_ids,
  experiential_knowledge_reentry_projections: [notPerformedFixture.reentry],
  experiential_method_transfer_projections: [notPerformedFixture.transfer],
});
const notPerformedApplication = notPerformedContext.resolver_view.applications[0];
assert.equal(notPerformedApplication.assessment_eligible, true);
assert.equal(notPerformedApplication.semantic_revision_currently_eligible, false);
assert.ok(notPerformedApplication.ambiguity_reasons.includes(
  "selected_action_not_confirmed_performed_in_subjective_experience",
));
assert.throws(
  () => projectWorldSimulationExperientialMethodOutcomeCredit({
    resolver_context: notPerformedContext,
    assessment_decisions: [{
      application_ref: notPerformedApplication.application_ref,
      assessment: "counterevidence_for_prior_method",
    }],
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_EXPERIENTIAL_METHOD_OUTCOME_CREDIT_REVISION_NOT_ELIGIBLE",
);

const tamperedReentry = structuredClone(fixture.reentry);
tamperedReentry.audit.world_truth_authority_claimed = true;
delete tamperedReentry.reentry_hash;
tamperedReentry.reentry_hash = hashAgentRunValue(tamperedReentry);
const tamperedTransfer = structuredClone(fixture.transfer);
tamperedTransfer.source_phase76d_reentry_hash = tamperedReentry.reentry_hash;
delete tamperedTransfer.transfer_hash;
tamperedTransfer.transfer_hash = hashAgentRunValue(tamperedTransfer);
const tamperedBundle = structuredClone(fixture.selected_applications);
tamperedBundle.receipts[0].source_phase76e_transfer_hash = tamperedTransfer.transfer_hash;
const tamperedReceipt = tamperedBundle.receipts[0];
const tamperedIdentity = {
  version: tamperedReceipt.version,
  world_simulation_session_id: tamperedReceipt.world_simulation_session_id,
  turn_id: tamperedReceipt.turn_id,
  state_revision: tamperedReceipt.state_revision,
  world_state_hash: tamperedReceipt.world_state_hash,
  character: tamperedReceipt.character,
  selection_kind: tamperedReceipt.selection_kind,
  action_id: tamperedReceipt.action_id,
  action_ref: tamperedReceipt.action_ref,
  phase74d_choice_receipt_id: tamperedReceipt.phase74d_choice_receipt_id,
  phase74d_choice_receipt_hash: tamperedReceipt.phase74d_choice_receipt_hash,
  source_phase76f_projection_hash: tamperedReceipt.source_phase76f_projection_hash,
  source_phase76e_transfer_hash: tamperedReceipt.source_phase76e_transfer_hash,
  candidate_attribution_refs: tamperedReceipt.candidate_attribution_refs,
  applied_method_refs: tamperedReceipt.applied_method_refs,
};
tamperedReceipt.receipt_hash = hashAgentRunValue(tamperedIdentity);
tamperedReceipt.receipt_id = `phase76f_application_${tamperedReceipt.receipt_hash.slice(0, 24)}`;
delete tamperedBundle.receipt_bundle_hash;
tamperedBundle.receipt_bundle_hash = hashAgentRunValue(tamperedBundle);
assert.throws(
  () => buildWorldSimulationExperientialMethodOutcomeCreditResolverContext({
    world_state: fixture.world_state,
    turn_id: fixture.turn_id,
    selected_application_receipts: tamperedBundle,
    phase76b_memory_bridge: fixture.bridge,
    source_memory_records: [{ character, memory_record: fixture.current_memory }],
    source_organization_event_ids: fixture.source_organization_event_ids,
    experiential_knowledge_reentry_projections: [tamperedReentry],
    experiential_method_transfer_projections: [tamperedTransfer],
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_EXPERIENTIAL_METHOD_OUTCOME_CREDIT_PHASE76D_BOUNDARY_INVALID",
);

const tamperedBridge = structuredClone(fixture.bridge);
tamperedBridge.boundaries.raw_action_outcomes_consumed = true;
delete tamperedBridge.bridge_hash;
tamperedBridge.bridge_hash = hashAgentRunValue(tamperedBridge);
assert.throws(
  () => buildWorldSimulationExperientialMethodOutcomeCreditResolverContext({
    world_state: fixture.world_state,
    turn_id: fixture.turn_id,
    selected_application_receipts: fixture.selected_applications,
    phase76b_memory_bridge: tamperedBridge,
    source_memory_records: [{ character, memory_record: fixture.current_memory }],
    source_organization_event_ids: fixture.source_organization_event_ids,
    experiential_knowledge_reentry_projections: [fixture.reentry],
    experiential_method_transfer_projections: [fixture.transfer],
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_EXPERIENTIAL_METHOD_OUTCOME_CREDIT_PHASE76B_BOUNDARY_INVALID",
);

const loopContract = buildWorldSimulationLoopContract();
assert.equal(
  loopContract.experiential_method_outcome_credit.version,
  worldSimulationExperientialMethodOutcomeCreditVersion,
);
assert.equal(
  loopContract.experiential_method_outcome_credit_resolver_hook.option_name,
  "experientialMethodOutcomeCreditResolver",
);
assert.equal(
  loopContract.experiential_method_outcome_credit_resolver_hook.receives_raw_action_outcome,
  false,
);
assert.equal(
  loopContract.experiential_method_outcome_credit_resolver_hook.durable_semantic_revision_owner,
  "Phase67C",
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
const ordinarySemanticIndex = loopSource.indexOf(
  "const personalSemanticMemoryMutationExecution =",
);
const outcomeCreditIndex = loopSource.indexOf(
  "const experientialMethodOutcomeCreditResolverContext =",
  ordinarySemanticIndex,
);
const secondSemanticIndex = loopSource.indexOf(
  "const experientialMethodSemanticRevision =",
  outcomeCreditIndex,
);
const lifePeriodIndex = loopSource.indexOf(
  "const autobiographicalLifePeriodDecisionResolution =",
  secondSemanticIndex,
);
assert.ok(
  ordinarySemanticIndex >= 0
    && outcomeCreditIndex > ordinarySemanticIndex
    && secondSemanticIndex > outcomeCreditIndex
    && lifePeriodIndex > secondSemanticIndex,
  "Phase76G must run after ordinary Phase67C and feed a second Phase67C append-only pass before Phase67D.",
);
assert.match(loopSource, /experiential_method_outcome_credit_resolution:/);
assert.match(loopSource, /experiential_method_semantic_revision:/);
assert.match(loopSource, /experiential_method_outcome_credit:\s*\{/);
assert.match(loopSource, /experiential_method_revision_decision_count:/);
assert.match(loopSource, /activated_knowledge_count:[\s\S]*activated_semantics/);
assert.match(loopSource, /transferred_method_count:[\s\S]*transferred_method_mappings/);
assert.match(stateSource, /experiential_method_outcome_credit_resolution:/);
assert.match(stateSource, /experiential_method_semantic_revision:/);

console.log("Phase76G experiential method outcome credit tests passed.");
