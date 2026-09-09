import assert from "node:assert/strict";
import fs from "node:fs";

import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import {
  buildWorldSimulationContextualSchemaSpecializationContract,
  buildWorldSimulationContextualSchemaSpecializationResolverView,
  projectWorldSimulationContextualSchemaSpecialization,
  worldSimulationContextualSchemaSpecializationVersion,
} from "../../server/src/world-simulation-contextual-schema-specialization-service.mjs";
import {
  worldSimulationContextualSchemaRefinementEvidenceVersion,
} from "../../server/src/world-simulation-contextual-schema-refinement-evidence-service.mjs";

function phase78AEvidence() {
  const resolverView = {
    version: worldSimulationContextualSchemaRefinementEvidenceVersion,
    turn_id: "phase78b_turn_001",
    refinement_candidates: [
      {
        refinement_candidate_ref: "phase78a_refinement_candidate_001",
        character: "測試角色",
        source_schema: {
          predicate: "method_helped_when",
          object_ref: "method:flank_then_press",
          qualifiers: ["target_attention_split"],
          knowledge_status: "contested",
          subjective_not_world_truth: true,
        },
        supporting_experience_evidence: [
          {
            evidence_ref: "phase78a_support_001",
            role: "supporting_experience",
            bounded_experiences: [{ action: "flank", perceived_result: "opened_route" }],
            experience_count: 1,
            subjective_not_world_truth: true,
          },
        ],
        counterexample_experience_evidence: [
          {
            evidence_ref: "phase78a_counter_001",
            role: "counterexample_experience",
            bounded_experiences: [{ action: "flank", perceived_result: "route_blocked" }],
            experience_count: 1,
            subjective_not_world_truth: true,
            current_turn_counterexample: true,
          },
        ],
        supporting_evidence_count: 1,
        counterexample_evidence_count: 1,
        current_turn_counterexample_count: 1,
        refinement_not_authored_yet: true,
        subjective_not_world_truth: true,
      },
    ],
    refinement_requirements: {
      contested_recurring_event_pattern_required: true,
      at_least_one_supporting_experience_required: true,
      at_least_one_counterexample_experience_required: true,
      current_turn_counterexample_required: true,
      source_relation_and_method_identity_must_be_preserved_downstream: true,
      refinement_must_narrow_applicability_not_rewrite_history: true,
    },
    boundaries: {
      source_phase67c_projection_verified: true,
      source_phase77a_evidence_verified: true,
      raw_world_state_exposed: false,
      raw_action_outcome_exposed: false,
      hidden_causal_evidence_exposed: false,
      semantic_memory_id_exposed: false,
      semantic_key_exposed: false,
      life_event_identity_exposed: false,
      internal_lineage_exposed: false,
      semantic_rewrite_requested: false,
      specialized_schema_authoring_requested: false,
      numeric_similarity_confidence_probability_requested: false,
      direct_durable_write_requested: false,
      same_turn_character_brain_feedback_requested: false,
    },
  };
  resolverView.resolver_view_hash = hashAgentRunValue(resolverView);
  const evidence = {
    version: worldSimulationContextualSchemaRefinementEvidenceVersion,
    turn_id: "phase78b_turn_001",
    source_phase67c_version: "phase67c-personal-semantic-memory-v1",
    source_phase67c_projection_hash: "phase67c_projection_hash_fixture",
    source_phase77a_evidence_view_hash: "phase77a_evidence_hash_fixture",
    resolver_view: resolverView,
    internal_lineage: [
      {
        refinement_candidate_ref: "phase78a_refinement_candidate_001",
        character: "測試角色",
        source_semantic_memory_id: "semantic_hidden_001",
        source_semantic_key: "semantic_key_hidden_001",
        source_semantic_descriptor_hash: "semantic_descriptor_hash_001",
        supporting_evidence_lineage: [],
        counterexample_evidence_lineage: [],
        current_counterevidence_life_event_refs: [],
      },
    ],
    refinement_candidate_count: 1,
    audit: {
      recurring_event_pattern_only: true,
      contested_schema_only: true,
      current_turn_counterevidence_required: true,
      supporting_and_counterexample_evidence_separated: true,
      semantic_rewrite_performed: false,
      specialized_schema_authored: false,
      durable_semantic_write_performed: false,
      recurrence_count_auto_resolved_contestation: false,
      numeric_similarity_confidence_probability_modeled: false,
      world_truth_authority_claimed: false,
      direct_belief_plan_goal_current_mind_world_mutation: false,
      same_turn_character_brain_feedback: false,
    },
  };
  evidence.evidence_hash = hashAgentRunValue(evidence);
  return evidence;
}

const contract = buildWorldSimulationContextualSchemaSpecializationContract();
assert.equal(contract.phase, "Phase78B");
assert.equal(contract.version, worldSimulationContextualSchemaSpecializationVersion);
assert.equal(contract.additive_narrowing_qualifiers_only, true);
assert.equal(contract.schema_output, "proposal_only");
assert.equal(contract.phase67c_durable_semantic_owner, true);
assert.equal(contract.same_turn_character_brain_feedback_allowed, false);

const evidence = phase78AEvidence();
const resolverView = buildWorldSimulationContextualSchemaSpecializationResolverView({
  contextual_schema_refinement_evidence: evidence,
});
assert.equal(resolverView.refinement_candidates.length, 1);
assert.equal(resolverView.boundaries.phase78a_internal_lineage_exposed, false);
assert.equal(JSON.stringify(resolverView).includes("semantic_hidden_001"), false);

const projection = projectWorldSimulationContextualSchemaSpecialization({
  contextual_schema_refinement_evidence: evidence,
  resolver_view_hash: resolverView.resolver_view_hash,
  specialization_proposals: [
    {
      refinement_candidate_ref: "phase78a_refinement_candidate_001",
      narrowing_qualifiers: ["escape_route_available"],
      contrast_groundings: [
        {
          qualifier: "escape_route_available",
          supporting_evidence_refs: ["phase78a_support_001"],
          counterexample_evidence_refs: ["phase78a_counter_001"],
        },
      ],
    },
  ],
});
assert.equal(projection.proposal_count, 1);
assert.deepEqual(
  projection.specialization_proposals[0].specialized_descriptor,
  {
    predicate: "method_helped_when",
    object_ref: "method:flank_then_press",
    qualifiers: ["escape_route_available", "target_attention_split"],
  },
);
assert.equal(projection.specialization_proposals[0].source_contested_state_preserved, true);
assert.equal(projection.specialization_proposals[0].proposal_only, true);
assert.equal(projection.audit.phase67c_semantic_decision_emitted, false);
assert.equal(projection.audit.same_turn_character_brain_feedback, false);

assert.throws(
  () => projectWorldSimulationContextualSchemaSpecialization({
    contextual_schema_refinement_evidence: evidence,
    specialization_proposals: [{
      refinement_candidate_ref: "phase78a_refinement_candidate_001",
      predicate: "resolver_must_not_rewrite_predicate",
      narrowing_qualifiers: ["escape_route_available"],
      contrast_groundings: [],
    }],
  }),
  (error) => error?.code === "WORLD_SIMULATION_CONTEXTUAL_SCHEMA_SPECIALIZATION_AUTHORITY_FIELD_FORBIDDEN",
);

assert.throws(
  () => projectWorldSimulationContextualSchemaSpecialization({
    contextual_schema_refinement_evidence: evidence,
    specialization_proposals: [{
      refinement_candidate_ref: "phase78a_refinement_candidate_001",
      narrowing_qualifiers: ["target_attention_split"],
      contrast_groundings: [{
        qualifier: "target_attention_split",
        supporting_evidence_refs: ["phase78a_support_001"],
        counterexample_evidence_refs: ["phase78a_counter_001"],
      }],
    }],
  }),
  (error) => error?.code === "WORLD_SIMULATION_CONTEXTUAL_SCHEMA_SPECIALIZATION_QUALIFIER_INVALID",
);

const tampered = structuredClone(evidence);
tampered.resolver_view.refinement_candidates[0].character = "被竄改";
assert.throws(
  () => buildWorldSimulationContextualSchemaSpecializationResolverView({
    contextual_schema_refinement_evidence: tampered,
  }),
  (error) => error?.code === "WORLD_SIMULATION_CONTEXTUAL_SCHEMA_SPECIALIZATION_PHASE78A_HASH_MISMATCH",
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
  /buildWorldSimulationContextualSchemaSpecializationResolverView\(\{[\s\S]*?contextual_schema_refinement_evidence:\s*contextualSchemaRefinementEvidence/,
  "Phase78B must consume the exact Phase78A evidence projection.",
);
assert.match(
  loopSource,
  /contextualSchemaSpecializationResolver[\s\S]*?projectWorldSimulationContextualSchemaSpecialization\(\{/,
  "Phase78B must keep resolver authorship bounded behind the canonical projector.",
);
assert.match(
  loopSource,
  /contextual_schema_specialization_resolution:\s*\{[\s\S]*?projection:\s*cloneJson\(contextualSchemaSpecialization\)/,
  "Phase78B projection must be included in the committed turn payload.",
);
assert.match(
  stateSource,
  /contextual_schema_specialization_resolution:\s*input\.contextual_schema_specialization_resolution \?\? null/,
  "Phase78B projection must be retained in committed world history.",
);

console.log("Phase78B contextual schema specialization tests passed.");
