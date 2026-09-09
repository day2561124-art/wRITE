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
  buildWorldSimulationMultiExperienceSchemaEvidenceView,
} from "../../server/src/world-simulation-multi-experience-schema-evidence-service.mjs";
import {
  buildWorldSimulationRelationalSchemaInductionResolverView,
  projectWorldSimulationRelationalSchemaInduction,
} from "../../server/src/world-simulation-relational-schema-induction-service.mjs";
import {
  buildWorldSimulationRelationalSchemaPromotionResolverView,
  projectWorldSimulationRelationalSchemaPromotion,
} from "../../server/src/world-simulation-relational-schema-promotion-service.mjs";
import {
  buildWorldSimulationPersonalSemanticMemoryDerivations,
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
import {
  buildWorldSimulationSubjectiveChoiceCommitmentReceipts,
} from "../../server/src/world-simulation-subjective-choice-commitment-receipt-service.mjs";
import {
  buildWorldSimulationExperientialMethodOutcomeCreditResolverContext,
  projectWorldSimulationExperientialMethodOutcomeCredit,
} from "../../server/src/world-simulation-experiential-method-outcome-credit-service.mjs";

const character = "伊萊亞斯・諾爾";
const descriptor = {
  predicate: "probe_before_primary_commitment",
  object_ref: "gather_reaction_then_adapt_main_method",
  qualifiers: ["low_risk_probe_first", "when_information_is_insufficient"],
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

function appendPostOutcomeActionLifeEvent(worldState, {
  turnId,
  sceneId,
  actionId,
  action,
  perceivedResult,
  perceivedStatus,
  performed = true,
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
    segmentation.result.state_transitions,
    `${turnId}:subjective_episode_segmentation`,
  );
  const segmentationIds = [
    ...segmentation.result.segmentation_events_created.map((event) => event.segmentation_event_id),
    ...segmentation.result.already_persisted_segmentation_event_ids,
  ];
  const organization = buildWorldSimulationAutobiographicalLifeEventOrganizations({
    world_state: segmentedWorld,
    turn_id: turnId,
    source_segmentation_event_ids: segmentationIds,
    organization_decisions: [],
  });
  const organizedWorld = applyTransitions(
    segmentedWorld,
    organization.result.preview_world_state,
    organization.result.state_transitions,
    `${turnId}:autobiographical_life_event`,
  );
  return {
    world_state: organizedWorld,
    organization_event_ids: organization.result.organization_events_created
      .map((event) => event.organization_event_id),
    memory,
    bridge,
    selected,
  };
}

function deriveSemantic(worldState, turnId, organizationEventIds, semanticDecisions) {
  const derivation = buildWorldSimulationPersonalSemanticMemoryDerivations({
    world_state: worldState,
    turn_id: turnId,
    source_organization_event_ids: organizationEventIds,
    semantic_decisions: semanticDecisions,
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

function buildLearnedRelationalSchemaState() {
  const baseWorld = {
    simulation_time: "2026-09-09T16:20:00.000Z",
    characters: { [character]: {} },
    memories: { [character]: [] },
  };
  const turn1 = "phase77d_learning_001";
  const first = appendPostOutcomeActionLifeEvent(baseWorld, {
    turnId: turn1,
    sceneId: "training_hall_alpha",
    actionId: "low_risk_probe_alpha",
    action: "先用低風險佯攻觀察對手反應，再決定主要攻勢",
    perceivedResult: "對手提前暴露了左側防守習慣",
    perceivedStatus: "取得可用反應線索",
  });
  assert.equal(first.organization_event_ids.length, 1);

  const turn2 = "phase77d_learning_002";
  const second = appendPostOutcomeActionLifeEvent(first.world_state, {
    turnId: turn2,
    sceneId: "training_hall_beta",
    actionId: "low_risk_probe_beta",
    action: "先製造小動靜確認對手反制方向，再選主要手段",
    perceivedResult: "對手注意力轉向聲音來源並暴露反制節奏",
    perceivedStatus: "取得可用反應線索",
  });
  assert.equal(second.organization_event_ids.length, 1);

  const phase77a = buildWorldSimulationMultiExperienceSchemaEvidenceView({
    world_state: second.world_state,
    turn_id: turn2,
    source_organization_event_ids: second.organization_event_ids,
  });
  assert.equal(phase77a.ready_character_count, 1);
  const context = phase77a.resolver_view.character_contexts[0];
  assert.equal(context.character, character);
  assert.equal(context.current_anchor_evidence.length, 1);
  assert.equal(context.prior_comparison_evidence.length, 1);
  const currentRef = context.current_anchor_evidence[0].evidence_ref;
  const priorRef = context.prior_comparison_evidence[0].evidence_ref;

  const phase77bView = buildWorldSimulationRelationalSchemaInductionResolverView({
    multi_experience_schema_evidence: phase77a,
  });
  const phase77b = projectWorldSimulationRelationalSchemaInduction({
    multi_experience_schema_evidence: phase77a,
    resolver_view_hash: phase77bView.resolver_view_hash,
    schema_proposals: [{
      character,
      mapping_kind: "relational_pattern",
      source_evidence_refs: [currentRef, priorRef],
      schema_descriptor: structuredClone(descriptor),
      evidence_groundings: [
        {
          evidence_ref: currentRef,
          experience_index: 0,
          grounding_fields: ["action", "perceived_result", "perceived_status"],
        },
        {
          evidence_ref: priorRef,
          experience_index: 0,
          grounding_fields: ["action", "perceived_result"],
        },
      ],
    }],
  });
  assert.equal(phase77b.proposal_count, 1);

  const phase77cView = buildWorldSimulationRelationalSchemaPromotionResolverView({
    relational_schema_induction: phase77b,
  });
  const phase77c = projectWorldSimulationRelationalSchemaPromotion({
    world_state: second.world_state,
    relational_schema_induction: phase77b,
    resolver_view_hash: phase77cView.resolver_view_hash,
    promotion_decisions: [{
      proposal_ref: phase77b.schema_proposals[0].proposal_ref,
      decision: "promote",
      reason: "phase77d_cross_turn_schema_closure",
    }],
  });
  assert.equal(phase77c.semantic_decisions.length, 1);
  assert.equal(phase77c.semantic_decisions[0].operation, "form");
  assert.equal(phase77c.semantic_decisions[0].semantic_category, "recurring_event_pattern");

  const durable = deriveSemantic(
    second.world_state,
    turn2,
    second.organization_event_ids,
    phase77c.semantic_decisions,
  );
  const formedEvent = durable.derivation.result.derivation_events_created[0];
  assert.equal(formedEvent.operation, "form");
  assert.deepEqual(formedEvent.semantic_descriptor, {
    subject_scope: "self_autobiographical_experience",
    ...descriptor,
  });

  const sameTurnReentryView = buildWorldSimulationExperientialKnowledgeReentryResolverView({
    world_state: durable.world_state,
    character,
    current_turn_id: turn2,
    current_context: {
      perception: { observed: [{ description: "仍在同一學習回合。" }] },
      current_goal: "完成訓練",
    },
  });
  assert.equal(
    sameTurnReentryView.candidate_personal_semantics.some((candidate) =>
      candidate.semantic_ref === formedEvent.semantic_memory_id),
    false,
    "A Phase77C semantic formed this turn must not feed back through Phase76D in the same turn.",
  );

  return {
    world_state: durable.world_state,
    semantic_memory_id: formedEvent.semantic_memory_id,
    semantic_key: formedEvent.semantic_key,
    learning_turn_id: turn2,
  };
}

function buildLaterTurnApplication(prior, {
  turnId,
  perceivedResult,
  perceivedStatus,
}) {
  const actionId = "probe_opponent_guard_then_adapt";
  const actionIntent = "先用低風險佯攻確認防守反應，再決定主要攻擊";
  const current = appendPostOutcomeActionLifeEvent(prior.world_state, {
    turnId,
    sceneId: "phase77d_field_test",
    actionId,
    action: actionIntent,
    perceivedResult,
    perceivedStatus,
  });
  assert.equal(current.organization_event_ids.length, 1);
  const currentContext = {
    perception: {
      observed: [{
        description: "新的對手防守習慣未知，貿然投入主要攻勢風險較高。",
      }],
    },
    current_goal: "先取得防守反應線索，再選擇主要攻勢",
  };

  const reentryView = buildWorldSimulationExperientialKnowledgeReentryResolverView({
    world_state: current.world_state,
    character,
    current_turn_id: turnId,
    current_context: currentContext,
  });
  const candidate = reentryView.candidate_personal_semantics.find((item) =>
    item.semantic_ref === prior.semantic_memory_id);
  assert.ok(candidate, "The exact Phase77C durable schema must be available to Phase76D on a later turn.");
  assert.equal(candidate.semantic_category, "recurring_event_pattern");
  assert.deepEqual(candidate.semantic_descriptor, {
    subject_scope: "self_autobiographical_experience",
    ...descriptor,
  });
  const resolverSerialized = JSON.stringify(reentryView);
  assert.equal(resolverSerialized.includes(`engine_hidden_result_${turnId}`), false);
  assert.equal(resolverSerialized.includes(`engine_hidden_causal_evidence_${turnId}`), false);

  const reentry = projectWorldSimulationExperientialKnowledgeReentry({
    resolver_view: reentryView,
    activated_semantic_refs: [candidate.semantic_ref],
  });
  assert.equal(reentry.activated_semantics.length, 1);
  assert.equal(reentry.character_view.experiential_knowledge.length, 1);
  assert.equal(reentry.character_view.experiential_knowledge[0].cue_retrieved, true);
  assert.equal(reentry.character_view.experiential_knowledge[0].advisory_only, true);
  assert.equal(
    JSON.stringify(reentry.character_view).includes(prior.semantic_memory_id),
    false,
    "Character-facing Phase76D knowledge must not expose durable semantic identity.",
  );

  const transferView = buildWorldSimulationExperientialMethodTransferResolverView({
    character,
    current_turn_id: turnId,
    experiential_knowledge_reentry: reentry,
    current_context: currentContext,
  });
  assert.equal(transferView.method_candidates.length, 1);
  assert.equal(transferView.method_candidates[0].method_skeleton.relation, descriptor.predicate);
  assert.equal(transferView.method_candidates[0].method_skeleton.method_ref, descriptor.object_ref);
  assert.ok(transferView.current_cue_catalog.length >= 1);
  const transfer = projectWorldSimulationExperientialMethodTransfer({
    resolver_view: transferView,
    transfer_mappings: [{
      transfer_ref: transferView.method_candidates[0].transfer_ref,
      mapping_kind: "structural_match",
      current_cue_refs: transferView.current_cue_catalog.map((cue) => cue.cue_ref),
    }],
  });
  assert.equal(transfer.transferred_method_mappings.length, 1);
  assert.equal(transfer.character_view.transferred_methods.length, 1);
  assert.equal(transfer.character_view.transferred_methods[0].relational_structure_transfer, true);
  assert.equal(transfer.character_view.transferred_methods[0].exact_action_replay, false);

  const candidateActions = [{
    action_id: actionId,
    intent: actionIntent,
    prerequisites: ["能觀察對手反應"],
    known_costs: ["暫緩主要攻勢"],
  }];
  const cognition = {
    experiential_method_guidance: transfer.character_view,
    current_action: "觀察對手防守",
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
  assert.equal(attribution.candidate_attributions.length, 1);

  const worldStateHash = hashAgentRunValue(current.world_state);
  const choiceBundle = buildWorldSimulationSubjectiveChoiceCommitmentReceipts({
    world_simulation_session_id: "phase77d_world_session",
    turn_id: turnId,
    state_revision: 9,
    world_state_hash: worldStateHash,
    decision_packets: [{
      character,
      cognition,
      candidate_action_intents: candidateActions,
    }],
    selected_action_intents: [{
      character,
      selection: "candidate_action_intent",
      action_id: actionId,
      intent: actionIntent,
    }],
  });
  const selectedApplications =
    buildWorldSimulationSelectedExperientialMethodApplicationReceipts({
      world_simulation_session_id: "phase77d_world_session",
      turn_id: turnId,
      state_revision: 9,
      world_state_hash: worldStateHash,
      candidate_attribution_projections: [attribution],
      subjective_choice_commitment_receipts: choiceBundle,
    });
  assert.equal(selectedApplications.receipt_count, 1);

  const outcomeContext = buildWorldSimulationExperientialMethodOutcomeCreditResolverContext({
    world_state: current.world_state,
    turn_id: turnId,
    selected_application_receipts: selectedApplications,
    phase76b_memory_bridge: current.bridge,
    source_memory_records: [{ character, memory_record: current.memory }],
    source_organization_event_ids: current.organization_event_ids,
    experiential_knowledge_reentry_projections: [reentry],
    experiential_method_transfer_projections: [transfer],
  });
  assert.equal(outcomeContext.resolver_view.applications.length, 1);
  assert.equal(outcomeContext.resolver_view.applications[0].assessment_eligible, true);
  assert.equal(outcomeContext.resolver_view.applications[0].semantic_revision_currently_eligible, true);
  assert.equal(
    JSON.stringify(outcomeContext.resolver_view).includes(prior.semantic_memory_id),
    false,
    "Phase76G resolver must not expose durable semantic identity.",
  );

  return {
    current,
    reentry,
    transfer,
    selected_applications: selectedApplications,
    outcome_context: outcomeContext,
  };
}

const learned = buildLearnedRelationalSchemaState();
let effective = projectWorldSimulationEffectivePersonalSemanticMemories({
  world_state: learned.world_state,
}).memories_by_character[character][learned.semantic_memory_id];
assert.ok(effective);
assert.equal(effective.semantic_category, "recurring_event_pattern");
assert.equal(effective.state, "supported");
assert.equal(effective.support_life_event_refs.length, 2);
assert.equal(effective.counterevidence_life_event_refs.length, 0);

const turn3 = "phase77d_reuse_003";
const later = buildLaterTurnApplication(learned, {
  turnId: turn3,
  perceivedResult: "對手提前暴露左側防守重心，之後可以調整主要攻勢",
  perceivedStatus: "取得可用防守線索",
});
const applicationRef = later.outcome_context.resolver_view.applications[0].application_ref;

const supported = projectWorldSimulationExperientialMethodOutcomeCredit({
  resolver_context: later.outcome_context,
  assessment_decisions: [{
    application_ref: applicationRef,
    assessment: "supports_prior_method",
  }],
});
assert.equal(supported.semantic_decision_count, 1);
assert.equal(supported.semantic_decisions[0].operation, "support");
assert.equal(supported.semantic_decisions[0].semantic_memory_id, learned.semantic_memory_id);
assert.equal(supported.semantic_decisions[0].semantic_key, learned.semantic_key);
const retained = deriveSemantic(
  later.current.world_state,
  turn3,
  later.current.organization_event_ids,
  supported.semantic_decisions,
);
effective = projectWorldSimulationEffectivePersonalSemanticMemories({
  world_state: retained.world_state,
}).memories_by_character[character][learned.semantic_memory_id];
assert.equal(effective.state, "supported");
assert.equal(effective.support_life_event_refs.length, 3);
assert.equal(effective.counterevidence_life_event_refs.length, 0);
assert.deepEqual(effective.semantic_descriptor, {
  subject_scope: "self_autobiographical_experience",
  ...descriptor,
});

// The same exact learned schema may instead receive bounded subjective
// counterevidence after a uniquely attributable performed application. The
// revision must target the same Phase77C semantic identity and preserve its
// descriptor; Phase67C records contestation rather than silently rewriting the
// learned rule.
const counter = projectWorldSimulationExperientialMethodOutcomeCredit({
  resolver_context: later.outcome_context,
  assessment_decisions: [{
    application_ref: applicationRef,
    assessment: "counterevidence_for_prior_method",
  }],
});
assert.equal(counter.semantic_decision_count, 1);
assert.equal(counter.semantic_decisions[0].operation, "counterevidence");
assert.equal(counter.semantic_decisions[0].semantic_memory_id, learned.semantic_memory_id);
const revised = deriveSemantic(
  later.current.world_state,
  turn3,
  later.current.organization_event_ids,
  counter.semantic_decisions,
);
effective = projectWorldSimulationEffectivePersonalSemanticMemories({
  world_state: revised.world_state,
}).memories_by_character[character][learned.semantic_memory_id];
assert.equal(effective.state, "contested");
assert.equal(effective.support_life_event_refs.length, 2);
assert.equal(effective.counterevidence_life_event_refs.length, 1);
assert.deepEqual(effective.semantic_descriptor, {
  subject_scope: "self_autobiographical_experience",
  ...descriptor,
});
assert.equal(effective.confidence, null);
assert.equal(effective.probability, null);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const loopSource = fs.readFileSync(
  path.resolve(__dirname, "../../server/src/world-simulation-loop-service.mjs"),
  "utf8",
);
const phase76dReentryIndex = loopSource.indexOf(
  "const experientialKnowledgeReentryResolverView =",
);
const phase77aEvidenceIndex = loopSource.indexOf(
  "const multiExperienceSchemaEvidence =",
  phase76dReentryIndex,
);
const phase77cAdmissionIndex = loopSource.indexOf(
  "const relationalSchemaPromotionResolverView =",
  phase77aEvidenceIndex,
);
assert.ok(
  phase76dReentryIndex >= 0
    && phase77aEvidenceIndex > phase76dReentryIndex
    && phase77cAdmissionIndex > phase77aEvidenceIndex,
  "Later-turn experiential re-entry must run before current-turn Phase77A/77C learning so newly learned schemas cannot feed back into the same turn.",
);

console.log("Phase77D cross-turn relational schema reuse and revision closure tests passed.");
