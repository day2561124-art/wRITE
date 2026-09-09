import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  hashAgentRunValue,
} from "../../server/src/agent-run-service.mjs";
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
  projectWorldSimulationEffectivePersonalSemanticMemories,
} from "../../server/src/world-simulation-personal-semantic-memory-service.mjs";
import {
  worldSimulationMultiExperienceSchemaEvidenceVersion,
} from "../../server/src/world-simulation-multi-experience-schema-evidence-service.mjs";
import {
  buildWorldSimulationRelationalSchemaInductionResolverView,
  projectWorldSimulationRelationalSchemaInduction,
} from "../../server/src/world-simulation-relational-schema-induction-service.mjs";
import {
  buildWorldSimulationRelationalSchemaPromotionContract,
  buildWorldSimulationRelationalSchemaPromotionResolverView,
  projectWorldSimulationRelationalSchemaPromotion,
  worldSimulationRelationalSchemaPromotionVersion,
} from "../../server/src/world-simulation-relational-schema-promotion-service.mjs";

const character = "伊萊亞斯・諾爾";

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

function source(memory) {
  return {
    character,
    memory_record: structuredClone(memory),
  };
}

function executeSegmentation(worldState, turnId, memories) {
  const segmentation = buildWorldSimulationSubjectiveEpisodeSegmentations({
    world_state: worldState,
    turn_id: turnId,
    source_memory_records: memories.map(source),
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
    world_state: execution.next_world_state,
    source_event_ids: [
      ...segmentation.result.segmentation_events_created.map((event) => event.segmentation_event_id),
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
    world_state: execution.next_world_state,
    source_event_ids: organization.result.organization_events_created
      .map((event) => event.organization_event_id),
  };
}

function executeSemantic(worldState, turnId, sourceOrganizationEventIds, semanticDecisions) {
  const derivation = buildWorldSimulationPersonalSemanticMemoryDerivations({
    world_state: worldState,
    turn_id: turnId,
    source_organization_event_ids: sourceOrganizationEventIds,
    semantic_decisions: semanticDecisions,
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
    world_state: execution.next_world_state,
  };
}

function organizationEvent(worldState, organizationEventId) {
  return worldState.autobiographical_life_event_organization_events[organizationEventId];
}

function phase77BProjection({
  worldState,
  turnId,
  currentOrganizationEventId,
  priorOrganizationEventId,
  descriptor,
  duplicateDescriptorProposal = false,
}) {
  const currentEvent = organizationEvent(worldState, currentOrganizationEventId);
  const priorEvent = organizationEvent(worldState, priorOrganizationEventId);
  const currentRef = `phase77a_evidence_${currentOrganizationEventId}`;
  const priorRef = `phase77a_evidence_${priorOrganizationEventId}`;
  const resolverView = {
    version: worldSimulationMultiExperienceSchemaEvidenceVersion,
    turn_id: turnId,
    character_contexts: [{
      character,
      current_anchor_evidence: [{
        evidence_ref: currentRef,
        role: "current_anchor",
        bounded_experiences: [{
          action: "先以低風險方式試探",
          performed: true,
          perceived_result: "觀察到對方反應後再調整主要手段",
          perceived_status: "取得可用線索",
          subjective_memory_not_world_truth: true,
        }],
        experience_count: 1,
        subjective_not_world_truth: true,
      }],
      prior_comparison_evidence: [{
        evidence_ref: priorRef,
        role: "prior_comparison_candidate",
        bounded_experiences: [{
          action: "先用小動作測試對方",
          performed: true,
          perceived_result: "先取得反應線索再決定後續",
          perceived_status: "取得可用線索",
          subjective_memory_not_world_truth: true,
        }],
        experience_count: 1,
        subjective_not_world_truth: true,
      }],
      current_anchor_count: 1,
      prior_comparison_candidate_count: 1,
      comparison_ready: true,
      minimum_distinct_life_events_for_schema: 2,
    }],
    comparison_requirements: {
      current_turn_anchor_required: true,
      same_character_only: true,
      minimum_distinct_life_events: 2,
      comparison_of_multiple_instances_required: true,
      relation_structure_must_be_derived_downstream: true,
      recurrence_count_is_not_schema_authority: true,
    },
    boundaries: {
      internal_lineage_exposed: false,
      relational_alignment_requested: false,
      semantic_schema_authoring_requested: false,
    },
  };
  resolverView.resolver_view_hash = hashAgentRunValue(resolverView);
  const phase77aEvidence = {
    version: worldSimulationMultiExperienceSchemaEvidenceVersion,
    turn_id: turnId,
    source_phase67a_projection_hash: "phase67a-projection-hash",
    source_phase67b_projection_hash: "phase67b-projection-hash",
    resolver_view: resolverView,
    internal_lineage: [
      {
        evidence_ref: currentRef,
        character,
        life_event_id: currentEvent.life_event_id,
        latest_organization_event_id: currentEvent.organization_event_id,
        latest_organization_event_hash: currentEvent.organization_event_hash,
        source_episode_refs: [],
        source_memory_refs: [],
      },
      {
        evidence_ref: priorRef,
        character,
        life_event_id: priorEvent.life_event_id,
        latest_organization_event_id: priorEvent.organization_event_id,
        latest_organization_event_hash: priorEvent.organization_event_hash,
        source_episode_refs: [],
        source_memory_refs: [],
      },
    ],
    ready_character_count: 1,
    audit: {
      relational_alignment_performed: false,
      schema_induction_performed: false,
      phase67c_semantic_decision_emitted: false,
    },
  };
  phase77aEvidence.evidence_view_hash = hashAgentRunValue(phase77aEvidence);
  const phase77bResolverView = buildWorldSimulationRelationalSchemaInductionResolverView({
    multi_experience_schema_evidence: phase77aEvidence,
  });
  return projectWorldSimulationRelationalSchemaInduction({
    multi_experience_schema_evidence: phase77aEvidence,
    resolver_view_hash: phase77bResolverView.resolver_view_hash,
    schema_proposals: [
      {
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
      },
      ...(duplicateDescriptorProposal
        ? [{
          character,
          mapping_kind: "relational_pattern",
          source_evidence_refs: [currentRef, priorRef],
          schema_descriptor: structuredClone(descriptor),
          evidence_groundings: [
            {
              evidence_ref: currentRef,
              experience_index: 0,
              grounding_fields: ["action", "perceived_result"],
            },
            {
              evidence_ref: priorRef,
              experience_index: 0,
              grounding_fields: ["action", "perceived_result", "perceived_status"],
            },
          ],
        }]
        : []),
    ],
  });
}

const contract = buildWorldSimulationRelationalSchemaPromotionContract();
assert.equal(contract.phase, "Phase77C");
assert.equal(contract.version, worldSimulationRelationalSchemaPromotionVersion);
assert.equal(contract.source_owner, "Phase77B");
assert.equal(contract.promotion_is_explicit_programmatic_decision, true);
assert.equal(contract.missing_promoter_means_no_promotion, true);
assert.equal(contract.minimum_distinct_life_events, 2);
assert.equal(contract.exact_phase77b_projection_hash_required, true);
assert.equal(contract.exact_phase77b_internal_lineage_required, true);
assert.equal(contract.exact_resolver_view_hash_required, true);
assert.equal(contract.phase67c_descriptor_bounds_required, true);
assert.equal(contract.descriptor_truncation_or_rewrite_allowed, false);
assert.equal(contract.exact_existing_descriptor_match_may_support, true);
assert.equal(contract.fuzzy_similarity_auto_merge_allowed, false);
assert.equal(contract.recurrence_count_auto_promotes_schema, false);
assert.equal(contract.numeric_similarity_confidence_probability_modeled, false);
assert.equal(contract.direct_durable_semantic_write_allowed, false);
assert.equal(contract.phase67c_append_only_form_or_support_required, true);
assert.equal(contract.same_turn_character_brain_feedback_allowed, false);

const turn1 = "world_turn_phase77c_001";
const memory1 = memoryFixture({
  memoryId: "memory_phase77c_elias_001",
  turnId: turn1,
  sceneId: "training_room",
  description: "第一次先試探再根據反應調整。",
});
const baseWorld = {
  memories: {
    [character]: [memory1],
  },
};
const segmented1 = executeSegmentation(baseWorld, turn1, [memory1]);
const life1 = executeLifeEvent(segmented1.world_state, turn1, segmented1.source_event_ids);
assert.equal(life1.source_event_ids.length, 1);

const turn2 = "world_turn_phase77c_002";
const memory2 = memoryFixture({
  memoryId: "memory_phase77c_elias_002",
  turnId: turn2,
  sceneId: "selection_arena",
  description: "第二次也先試探再依觀察結果選擇主要手段。",
});
const world2 = structuredClone(life1.world_state);
world2.memories[character].push(memory2);
const segmented2 = executeSegmentation(world2, turn2, [memory2]);
const life2 = executeLifeEvent(segmented2.world_state, turn2, segmented2.source_event_ids);
assert.equal(life2.source_event_ids.length, 1);

const descriptor = {
  predicate: "probe_before_primary_commitment",
  object_ref: "gather_reaction_then_adapt_main_method",
  qualifiers: ["low_risk_probe_first", "when_information_is_insufficient"],
};
const schema2 = phase77BProjection({
  worldState: life2.world_state,
  turnId: turn2,
  currentOrganizationEventId: life2.source_event_ids[0],
  priorOrganizationEventId: life1.source_event_ids[0],
  descriptor,
});
assert.equal(schema2.proposal_count, 1);

const promotionView2 = buildWorldSimulationRelationalSchemaPromotionResolverView({
  relational_schema_induction: schema2,
});
assert.equal(promotionView2.candidates.length, 1);
assert.equal(promotionView2.candidates[0].promotion_eligible, true);
assert.equal(promotionView2.decision_contract.promoter_may_author_schema_content, false);
assert.equal(promotionView2.decision_contract.promoter_may_choose_semantic_identity, false);
assert.equal(promotionView2.boundaries.phase77b_internal_lineage_exposed, false);
assert.equal(promotionView2.boundaries.existing_semantic_store_exposed, false);
const serializedPromotionView = JSON.stringify(promotionView2);
assert.equal(serializedPromotionView.includes(life1.source_event_ids[0]), false);
assert.equal(serializedPromotionView.includes(life2.source_event_ids[0]), false);

const noPromotion = projectWorldSimulationRelationalSchemaPromotion({
  world_state: life2.world_state,
  relational_schema_induction: schema2,
  resolver_view_hash: promotionView2.resolver_view_hash,
  promotion_decisions: [],
});
assert.equal(noPromotion.emitted_phase67c_semantic_decision_count, 0);
assert.equal(noPromotion.audit.missing_decision_means_no_promotion, true);

// Different Phase77B proposal identities may still collapse onto exactly the
// same durable Phase67C semantic identity. Phase77C must reject that collision
// in-turn rather than emitting two competing form/support decisions and relying
// on the downstream append-only executor to discover the conflict.
const duplicateIdentitySchema = phase77BProjection({
  worldState: life2.world_state,
  turnId: turn2,
  currentOrganizationEventId: life2.source_event_ids[0],
  priorOrganizationEventId: life1.source_event_ids[0],
  descriptor,
  duplicateDescriptorProposal: true,
});
assert.equal(duplicateIdentitySchema.proposal_count, 2);
assert.notEqual(
  duplicateIdentitySchema.schema_proposals[0].proposal_ref,
  duplicateIdentitySchema.schema_proposals[1].proposal_ref,
);
assert.deepEqual(
  duplicateIdentitySchema.schema_proposals[0].schema_descriptor,
  duplicateIdentitySchema.schema_proposals[1].schema_descriptor,
);
const duplicateIdentityView = buildWorldSimulationRelationalSchemaPromotionResolverView({
  relational_schema_induction: duplicateIdentitySchema,
});
assert.throws(
  () => projectWorldSimulationRelationalSchemaPromotion({
    world_state: life2.world_state,
    relational_schema_induction: duplicateIdentitySchema,
    resolver_view_hash: duplicateIdentityView.resolver_view_hash,
    promotion_decisions: duplicateIdentitySchema.schema_proposals.map((proposal) => ({
      proposal_ref: proposal.proposal_ref,
      decision: "promote",
    })),
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_RELATIONAL_SCHEMA_PROMOTION_DUPLICATE_SEMANTIC_IDENTITY_IN_TURN",
);

const promoted2 = projectWorldSimulationRelationalSchemaPromotion({
  world_state: life2.world_state,
  relational_schema_induction: schema2,
  resolver_view_hash: promotionView2.resolver_view_hash,
  promotion_decisions: [{
    proposal_ref: schema2.schema_proposals[0].proposal_ref,
    decision: "promote",
    reason: "shared relational structure is durable and experience-near",
  }],
});
assert.equal(promoted2.emitted_phase67c_semantic_decision_count, 1);
assert.equal(promoted2.promotions[0].phase67c_operation, "form");
assert.equal(promoted2.promotions[0].exact_existing_identity_reused, false);
assert.equal(promoted2.audit.phase67c_durable_semantic_owner_preserved, true);
assert.equal(promoted2.audit.fuzzy_similarity_auto_merge_used, false);
assert.equal(promoted2.audit.direct_durable_semantic_write_performed, false);
assert.equal(promoted2.semantic_decisions[0].semantic_category, "recurring_event_pattern");
assert.deepEqual(promoted2.semantic_decisions[0].semantic_descriptor, descriptor);
assert.equal(promoted2.semantic_decisions[0].source_life_event_refs.length, 2);

// The emitted Phase77C decision is not merely shape-compatible: it is accepted
// unchanged by the existing authoritative Phase67C derivation and mutation path.
const durable2 = executeSemantic(
  life2.world_state,
  turn2,
  life2.source_event_ids,
  promoted2.semantic_decisions,
);
assert.equal(durable2.derivation.result.derivation_events_created.length, 1);
const formedEvent = durable2.derivation.result.derivation_events_created[0];
assert.equal(formedEvent.operation, "form");
assert.equal(
  formedEvent.derivation_evidence.decision_source,
  "programmatic_personal_semantic_memory_resolver",
);
assert.equal(
  formedEvent.derivation_evidence.decision_reason,
  "shared relational structure is durable and experience-near",
);
assert.equal(formedEvent.subjective_not_world_truth, true);
assert.equal(formedEvent.epistemic_acceptance_decided, false);
assert.equal(formedEvent.confidence, null);
assert.equal(formedEvent.probability, null);
let effective = projectWorldSimulationEffectivePersonalSemanticMemories({
  world_state: durable2.world_state,
});
assert.equal(
  effective.memories_by_character[character][formedEvent.semantic_memory_id].state,
  "supported",
);

// A later exact schema identity must support the existing Phase67C memory
// rather than creating a second semantic identity.
const turn3 = "world_turn_phase77c_003";
const memory3 = memoryFixture({
  memoryId: "memory_phase77c_elias_003",
  turnId: turn3,
  sceneId: "field_test",
  description: "第三次在不同場景仍先試探再依反應調整。",
});
const world3 = structuredClone(durable2.world_state);
world3.memories[character].push(memory3);
const segmented3 = executeSegmentation(world3, turn3, [memory3]);
const life3 = executeLifeEvent(segmented3.world_state, turn3, segmented3.source_event_ids);
const schema3 = phase77BProjection({
  worldState: life3.world_state,
  turnId: turn3,
  currentOrganizationEventId: life3.source_event_ids[0],
  priorOrganizationEventId: life1.source_event_ids[0],
  descriptor,
});
const promotionView3 = buildWorldSimulationRelationalSchemaPromotionResolverView({
  relational_schema_induction: schema3,
});
const promoted3 = projectWorldSimulationRelationalSchemaPromotion({
  world_state: life3.world_state,
  relational_schema_induction: schema3,
  resolver_view_hash: promotionView3.resolver_view_hash,
  promotion_decisions: [{
    proposal_ref: schema3.schema_proposals[0].proposal_ref,
    decision: "promote",
  }],
});
assert.equal(promoted3.semantic_decisions.length, 1);
assert.equal(promoted3.semantic_decisions[0].operation, "support");
assert.equal(promoted3.semantic_decisions[0].semantic_memory_id, formedEvent.semantic_memory_id);
assert.equal(promoted3.semantic_decisions[0].semantic_key, formedEvent.semantic_key);
assert.equal(promoted3.promotions[0].exact_existing_identity_reused, true);
const durable3 = executeSemantic(
  life3.world_state,
  turn3,
  life3.source_event_ids,
  promoted3.semantic_decisions,
);
assert.equal(durable3.derivation.result.derivation_events_created[0].operation, "support");
effective = projectWorldSimulationEffectivePersonalSemanticMemories({
  world_state: durable3.world_state,
});
assert.equal(
  effective.memories_by_character[character][formedEvent.semantic_memory_id]
    .support_life_event_refs.length,
  3,
);

// Exact identity is intentionally strict. A nearby-but-different descriptor is
// a new form candidate instead of a fuzzy merge into the existing semantic.
const nearDescriptor = {
  ...descriptor,
  qualifiers: ["when_information_is_insufficient", "probe_before_commitment"],
};
const nearSchema = phase77BProjection({
  worldState: life3.world_state,
  turnId: turn3,
  currentOrganizationEventId: life3.source_event_ids[0],
  priorOrganizationEventId: life1.source_event_ids[0],
  descriptor: nearDescriptor,
});
const nearView = buildWorldSimulationRelationalSchemaPromotionResolverView({
  relational_schema_induction: nearSchema,
});
const nearPromotion = projectWorldSimulationRelationalSchemaPromotion({
  world_state: life3.world_state,
  relational_schema_induction: nearSchema,
  resolver_view_hash: nearView.resolver_view_hash,
  promotion_decisions: [{
    proposal_ref: nearSchema.schema_proposals[0].proposal_ref,
    decision: "promote",
  }],
});
assert.equal(nearPromotion.semantic_decisions[0].operation, "form");
assert.equal(nearPromotion.audit.fuzzy_similarity_auto_merge_used, false);

// Phase77B permits a wider proposal descriptor than Phase67C durable semantics.
// Phase77C exposes the mismatch and fails closed; it never truncates or silently
// rewrites the learned pattern merely to make persistence succeed.
const oversizedDescriptor = {
  predicate: "x".repeat(161),
  object_ref: "still-bounded-for-phase77b",
  qualifiers: [],
};
const oversizedSchema = phase77BProjection({
  worldState: life3.world_state,
  turnId: turn3,
  currentOrganizationEventId: life3.source_event_ids[0],
  priorOrganizationEventId: life1.source_event_ids[0],
  descriptor: oversizedDescriptor,
});
const oversizedView = buildWorldSimulationRelationalSchemaPromotionResolverView({
  relational_schema_induction: oversizedSchema,
});
assert.equal(oversizedView.candidates[0].promotion_eligible, false);
assert.deepEqual(
  oversizedView.candidates[0].ineligibility_reasons,
  ["predicate_outside_phase67c_bound"],
);
assert.throws(
  () => projectWorldSimulationRelationalSchemaPromotion({
    world_state: life3.world_state,
    relational_schema_induction: oversizedSchema,
    resolver_view_hash: oversizedView.resolver_view_hash,
    promotion_decisions: [{
      proposal_ref: oversizedSchema.schema_proposals[0].proposal_ref,
      decision: "promote",
    }],
  }),
  (error) => error?.code === "WORLD_SIMULATION_RELATIONAL_SCHEMA_PROMOTION_DESCRIPTOR_NOT_DURABLE",
);

assert.throws(
  () => projectWorldSimulationRelationalSchemaPromotion({
    world_state: life2.world_state,
    relational_schema_induction: schema2,
    resolver_view_hash: promotionView2.resolver_view_hash,
    promotion_decisions: [{
      proposal_ref: schema2.schema_proposals[0].proposal_ref,
      decision: "promote",
      similarity_score: 0.99,
    }],
  }),
  (error) => error?.code === "WORLD_SIMULATION_RELATIONAL_SCHEMA_PROMOTION_FORBIDDEN_FIELD",
  "Numeric similarity must never become Phase77C promotion authority.",
);

assert.throws(
  () => projectWorldSimulationRelationalSchemaPromotion({
    world_state: life2.world_state,
    relational_schema_induction: schema2,
    promotion_decisions: [{
      proposal_ref: schema2.schema_proposals[0].proposal_ref,
      decision: "promote",
    }],
  }),
  (error) => error?.code === "WORLD_SIMULATION_RELATIONAL_SCHEMA_PROMOTION_INPUT_INVALID",
  "Phase77C promotion decisions must be pinned to the exact canonical resolver view.",
);

assert.throws(
  () => projectWorldSimulationRelationalSchemaPromotion({
    world_state: life2.world_state,
    relational_schema_induction: schema2,
    resolver_view_hash: promotionView2.resolver_view_hash,
    promotion_decisions: [{
      proposal_ref: schema2.schema_proposals[0].proposal_ref,
      decision: "promote",
      semantic_key: "promoter-must-not-author-this",
    }],
  }),
  (error) => error?.code === "WORLD_SIMULATION_RELATIONAL_SCHEMA_PROMOTION_DECISION_SHAPE_INVALID",
  "Phase77C promoter must not be able to author semantic identity or schema fields.",
);

const tamperedSchema = structuredClone(schema2);
tamperedSchema.schema_proposals[0].schema_descriptor.predicate = "tampered-pattern";
assert.throws(
  () => buildWorldSimulationRelationalSchemaPromotionResolverView({
    relational_schema_induction: tamperedSchema,
  }),
  (error) => error?.code === "WORLD_SIMULATION_RELATIONAL_SCHEMA_PROMOTION_PHASE77B_HASH_MISMATCH",
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
const phase77bIndex = loopSource.indexOf("const relationalSchemaInductionResolverView =");
const phase77cAdmissionIndex = loopSource.indexOf(
  "const relationalSchemaPromotionResolverView =",
  phase77bIndex,
);
const ordinaryPhase67cIndex = loopSource.indexOf(
  "const personalSemanticDecisionResolution =",
  phase77cAdmissionIndex,
);
const phase77cProjectionIndex = loopSource.indexOf(
  "const relationalSchemaPromotion =",
  ordinaryPhase67cIndex,
);
const phase77cDurableIndex = loopSource.indexOf(
  "const relationalSchemaSemanticPromotion =",
  phase77cProjectionIndex,
);
const phase76gIndex = loopSource.indexOf(
  "const experientialMethodOutcomeCreditResolverContext =",
  phase77cDurableIndex,
);
assert.ok(
  phase77bIndex >= 0
    && phase77cAdmissionIndex > phase77bIndex
    && ordinaryPhase67cIndex > phase77cAdmissionIndex
    && phase77cProjectionIndex > ordinaryPhase67cIndex
    && phase77cDurableIndex > phase77cProjectionIndex
    && phase76gIndex > phase77cDurableIndex,
  "Phase77C must admit after Phase77B, resolve exact semantic identity after ordinary Phase67C, and finish before Phase76G retain/revise.",
);
assert.match(loopSource, /relationalSchemaPromotionResolver/);
assert.match(loopSource, /relational_schema_promotion_resolution:/);
assert.match(loopSource, /relational_schema_semantic_promotion:/);
assert.match(loopSource, /fuzzy_similarity_auto_merge_used:\s*false/);
assert.match(loopSource, /same_turn_character_brain_feedback_allowed:\s*false/);
assert.match(stateSource, /relational_schema_promotion_resolution:/);
assert.match(stateSource, /relational_schema_semantic_promotion_mutation_execution:/);

console.log("Phase77C relational schema promotion tests passed.");
