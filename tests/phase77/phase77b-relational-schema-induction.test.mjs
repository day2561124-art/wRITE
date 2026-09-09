import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import {
  worldSimulationMultiExperienceSchemaEvidenceVersion,
} from "../../server/src/world-simulation-multi-experience-schema-evidence-service.mjs";
import {
  buildWorldSimulationRelationalSchemaInductionContract,
  buildWorldSimulationRelationalSchemaInductionResolverView,
  projectWorldSimulationRelationalSchemaInduction,
  worldSimulationRelationalSchemaInductionVersion,
} from "../../server/src/world-simulation-relational-schema-induction-service.mjs";

const character = "伊萊亞斯・諾爾";

function phase77aFixture() {
  const currentRef = "phase77a_evidence_current_001";
  const priorRef = "phase77a_evidence_prior_001";
  const resolverView = {
    version: worldSimulationMultiExperienceSchemaEvidenceVersion,
    turn_id: "phase77b-turn-002",
    character_contexts: [{
      character,
      current_anchor_evidence: [{
        evidence_ref: currentRef,
        role: "current_anchor",
        bounded_experiences: [
          {
            action: "先快速確認出口是否暢通",
            performed: true,
            perceived_result: "出口沒有立即阻礙",
            perceived_status: "完成環境確認",
            subjective_memory_not_world_truth: true,
          },
          {
            action: "先製造小動靜觀察對手反應",
            performed: true,
            perceived_result: "對手注意力轉向聲音來源",
            perceived_status: "成功取得反應線索",
            subjective_memory_not_world_truth: true,
          },
        ],
        experience_count: 2,
        subjective_not_world_truth: true,
      }],
      prior_comparison_evidence: [{
        evidence_ref: priorRef,
        role: "prior_comparison_candidate",
        bounded_experiences: [
          {
            action: "先用低風險動作試探對方",
            performed: true,
            perceived_result: "對方提前暴露防守習慣",
            perceived_status: "取得更多線索",
            subjective_memory_not_world_truth: true,
          },
          {
            action: "先退到側面確認視線死角",
            performed: true,
            perceived_result: "發現側翼視線受遮蔽",
            perceived_status: "取得環境線索",
            subjective_memory_not_world_truth: true,
          },
        ],
        experience_count: 2,
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
  const evidence = {
    version: worldSimulationMultiExperienceSchemaEvidenceVersion,
    turn_id: "phase77b-turn-002",
    source_phase67a_projection_hash: "phase67a-projection-hash",
    source_phase67b_projection_hash: "phase67b-projection-hash",
    resolver_view: resolverView,
    internal_lineage: [
      {
        evidence_ref: currentRef,
        character,
        life_event_id: "life_event_current",
        latest_organization_event_id: "organization_current",
        latest_organization_event_hash: "organization_current_hash",
        source_episode_refs: [],
        source_memory_refs: [],
      },
      {
        evidence_ref: priorRef,
        character,
        life_event_id: "life_event_prior",
        latest_organization_event_id: "organization_prior",
        latest_organization_event_hash: "organization_prior_hash",
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
  evidence.evidence_view_hash = hashAgentRunValue(evidence);
  return { evidence, currentRef, priorRef };
}

const contract = buildWorldSimulationRelationalSchemaInductionContract();
assert.equal(contract.phase, "Phase77B");
assert.equal(contract.version, worldSimulationRelationalSchemaInductionVersion);
assert.equal(contract.source_owner, "Phase77A");
assert.equal(contract.phase77a_exact_projection_hash_verified, true);
assert.equal(contract.same_character_only, true);
assert.equal(contract.minimum_distinct_life_events, 2);
assert.equal(contract.current_turn_anchor_must_participate, true);
assert.equal(contract.prior_comparison_evidence_must_participate, true);
assert.equal(contract.one_to_one_evidence_mapping_required, true);
assert.equal(contract.exact_experience_index_required, true);
assert.equal(contract.parallel_connectivity_required, true);
assert.deepEqual(contract.systematicity_minimum_grounding_fields, ["action", "perceived_result"]);
assert.equal(contract.schema_output, "proposal_only");
assert.equal(contract.phase67c_durable_semantic_owner, true);
assert.equal(contract.phase77c_promotion_owner, true);
assert.equal(contract.recurrence_count_auto_promotes_schema, false);
assert.equal(contract.surface_similarity_alone_is_sufficient, false);
assert.equal(contract.numeric_similarity_threshold_modeled, false);
assert.equal(contract.numeric_confidence_probability_modeled, false);
assert.equal(contract.raw_world_state_exposed, false);
assert.equal(contract.raw_action_outcome_exposed, false);
assert.equal(contract.hidden_causal_evidence_exposed, false);
assert.equal(contract.internal_life_event_episode_memory_lineage_exposed_to_resolver, false);
assert.equal(contract.same_turn_character_brain_feedback_allowed, false);

const { evidence, currentRef, priorRef } = phase77aFixture();
const resolverView = buildWorldSimulationRelationalSchemaInductionResolverView({
  multi_experience_schema_evidence: evidence,
});
assert.equal(resolverView.version, worldSimulationRelationalSchemaInductionVersion);
assert.equal(resolverView.character_contexts.length, 1);
assert.equal(resolverView.character_contexts[0].character, character);
assert.equal(resolverView.proposal_contract.source_refs_must_include_current_anchor, true);
assert.equal(resolverView.proposal_contract.source_refs_must_include_prior_comparison, true);
assert.equal(resolverView.proposal_contract.evidence_grounding_must_be_one_to_one, true);
assert.equal(resolverView.proposal_contract.exact_experience_index_required, true);
assert.deepEqual(
  resolverView.proposal_contract.required_grounding_fields_per_evidence,
  ["action", "perceived_result"],
);
assert.equal(resolverView.boundaries.phase77a_internal_lineage_exposed, false);
assert.equal(resolverView.boundaries.numeric_similarity_confidence_probability_requested, false);
assert.equal(resolverView.boundaries.durable_semantic_write_requested, false);
assert.equal(resolverView.boundaries.character_brain_feedback_requested, false);
const serializedResolverView = JSON.stringify(resolverView);
for (const hidden of [
  "life_event_current",
  "life_event_prior",
  "organization_current",
  "organization_prior",
  "organization_current_hash",
  "organization_prior_hash",
]) {
  assert.equal(serializedResolverView.includes(hidden), false);
}

const projection = projectWorldSimulationRelationalSchemaInduction({
  multi_experience_schema_evidence: evidence,
  resolver_view_hash: resolverView.resolver_view_hash,
  schema_proposals: [{
    character,
    mapping_kind: "relational_pattern",
    source_evidence_refs: [currentRef, priorRef],
    schema_descriptor: {
      predicate: "先取得對方反應再決定主要手段",
      object_ref: "低成本試探後依觀察結果調整後續行動",
      qualifiers: ["資訊不足時", "先觀察反應"],
    },
    evidence_groundings: [
      {
        evidence_ref: currentRef,
        experience_index: 1,
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
assert.equal(projection.version, worldSimulationRelationalSchemaInductionVersion);
assert.equal(projection.proposal_count, 1);
assert.equal(projection.schema_proposals.length, 1);
assert.equal(projection.schema_proposals[0].subjective_pattern_not_world_truth, true);
assert.equal(projection.schema_proposals[0].durable_semantic_write_performed, false);
assert.equal(projection.schema_proposals[0].schema_descriptor.predicate, "先取得對方反應再決定主要手段");
assert.deepEqual(
  projection.schema_proposals[0].source_evidence_refs,
  [currentRef, priorRef].sort(),
);
const groundingByRef = new Map(
  projection.schema_proposals[0].evidence_groundings
    .map((grounding) => [grounding.evidence_ref, grounding]),
);
assert.equal(groundingByRef.get(currentRef).experience_index, 1);
assert.equal(groundingByRef.get(priorRef).experience_index, 0);
assert.deepEqual(
  groundingByRef.get(currentRef).grounding_fields,
  ["action", "perceived_result", "perceived_status"].sort(),
);
assert.equal(projection.internal_lineage[0].source_life_event_refs.length, 2);
assert.equal(projection.audit.one_to_one_evidence_mapping_verified, true);
assert.equal(projection.audit.exact_experience_index_grounding_verified, true);
assert.equal(projection.audit.parallel_connectivity_required, true);
assert.equal(projection.audit.systematicity_grounding_required, true);
assert.equal(projection.audit.action_and_perceived_result_required_per_case, true);
assert.equal(projection.audit.recurrence_count_auto_promoted, false);
assert.equal(projection.audit.surface_similarity_alone_used, false);
assert.equal(projection.audit.durable_semantic_write_performed, false);
assert.equal(projection.audit.phase67c_semantic_decision_emitted, false);
assert.equal(projection.audit.world_truth_authority_claimed, false);
assert.equal(projection.audit.numeric_similarity_confidence_probability_modeled, false);
assert.equal(projection.audit.same_turn_character_brain_feedback, false);

assert.throws(
  () => projectWorldSimulationRelationalSchemaInduction({
    multi_experience_schema_evidence: evidence,
    schema_proposals: [{
      character,
      mapping_kind: "relational_pattern",
      source_evidence_refs: [currentRef],
      schema_descriptor: { predicate: "過早泛化", object_ref: "單一案例", qualifiers: [] },
      evidence_groundings: [{
        evidence_ref: currentRef,
        experience_index: 0,
        grounding_fields: ["action", "perceived_result"],
      }],
    }],
  }),
  (error) => error?.code === "WORLD_SIMULATION_RELATIONAL_SCHEMA_INDUCTION_EVIDENCE_REFS_INVALID",
  "A single experience must never become a Phase77B relational schema proposal.",
);

assert.throws(
  () => projectWorldSimulationRelationalSchemaInduction({
    multi_experience_schema_evidence: evidence,
    schema_proposals: [{
      character,
      mapping_kind: "relational_pattern",
      source_evidence_refs: [currentRef, currentRef, priorRef],
      schema_descriptor: { predicate: "重複證據", object_ref: "不得把同一案例重複計票", qualifiers: [] },
      evidence_groundings: [
        { evidence_ref: currentRef, experience_index: 1, grounding_fields: ["action", "perceived_result"] },
        { evidence_ref: priorRef, experience_index: 0, grounding_fields: ["action", "perceived_result"] },
      ],
    }],
  }),
  (error) => error?.code === "WORLD_SIMULATION_RELATIONAL_SCHEMA_INDUCTION_EVIDENCE_REFS_INVALID",
  "Duplicate source evidence refs must fail instead of being silently deduplicated into recurrence authority.",
);

assert.throws(
  () => projectWorldSimulationRelationalSchemaInduction({
    multi_experience_schema_evidence: evidence,
    schema_proposals: [{
      character,
      mapping_kind: "relational_pattern",
      source_evidence_refs: [currentRef, priorRef],
      schema_descriptor: { predicate: "索引缺失", object_ref: "模糊指向整個 LifeEvent", qualifiers: [] },
      evidence_groundings: [
        { evidence_ref: currentRef, grounding_fields: ["action", "perceived_result"] },
        { evidence_ref: priorRef, experience_index: 0, grounding_fields: ["action", "perceived_result"] },
      ],
    }],
  }),
  (error) => error?.code === "WORLD_SIMULATION_RELATIONAL_SCHEMA_INDUCTION_GROUNDING_INVALID",
  "Each grounding must identify one exact experience inside a multi-experience LifeEvent.",
);

assert.throws(
  () => projectWorldSimulationRelationalSchemaInduction({
    multi_experience_schema_evidence: evidence,
    schema_proposals: [{
      character,
      mapping_kind: "relational_pattern",
      source_evidence_refs: [currentRef, priorRef],
      schema_descriptor: { predicate: "索引越界", object_ref: "不存在的具體經驗", qualifiers: [] },
      evidence_groundings: [
        { evidence_ref: currentRef, experience_index: 2, grounding_fields: ["action", "perceived_result"] },
        { evidence_ref: priorRef, experience_index: 0, grounding_fields: ["action", "perceived_result"] },
      ],
    }],
  }),
  (error) => error?.code === "WORLD_SIMULATION_RELATIONAL_SCHEMA_INDUCTION_GROUNDING_INVALID",
  "A grounding index outside the selected LifeEvent evidence must fail closed.",
);

assert.throws(
  () => projectWorldSimulationRelationalSchemaInduction({
    multi_experience_schema_evidence: evidence,
    schema_proposals: [{
      character,
      mapping_kind: "relational_pattern",
      source_evidence_refs: [currentRef, priorRef],
      schema_descriptor: { predicate: "缺少結果連結", object_ref: "只看行動表面", qualifiers: [] },
      evidence_groundings: [
        { evidence_ref: currentRef, experience_index: 1, grounding_fields: ["action"] },
        { evidence_ref: priorRef, experience_index: 0, grounding_fields: ["action"] },
      ],
    }],
  }),
  (error) => error?.code === "WORLD_SIMULATION_RELATIONAL_SCHEMA_INDUCTION_GROUNDING_INVALID",
  "Surface action resemblance without action-result connectivity is insufficient.",
);

assert.throws(
  () => projectWorldSimulationRelationalSchemaInduction({
    multi_experience_schema_evidence: evidence,
    schema_proposals: [{
      character,
      mapping_kind: "relational_pattern",
      source_evidence_refs: [currentRef, priorRef],
      similarity_score: 0.99,
      schema_descriptor: { predicate: "數值投票", object_ref: "不允許", qualifiers: [] },
      evidence_groundings: [
        { evidence_ref: currentRef, experience_index: 1, grounding_fields: ["action", "perceived_result"] },
        { evidence_ref: priorRef, experience_index: 0, grounding_fields: ["action", "perceived_result"] },
      ],
    }],
  }),
  (error) => error?.code === "WORLD_SIMULATION_RELATIONAL_SCHEMA_INDUCTION_FORBIDDEN_FIELD",
  "Numeric similarity/confidence voting must not become schema authority.",
);

const crossCharacterLineageEvidence = structuredClone(evidence);
crossCharacterLineageEvidence.internal_lineage
  .find((item) => item.evidence_ref === priorRef).character = "柊木璃央";
delete crossCharacterLineageEvidence.evidence_view_hash;
crossCharacterLineageEvidence.evidence_view_hash = hashAgentRunValue(crossCharacterLineageEvidence);
assert.throws(
  () => projectWorldSimulationRelationalSchemaInduction({
    multi_experience_schema_evidence: crossCharacterLineageEvidence,
    schema_proposals: [{
      character,
      mapping_kind: "relational_pattern",
      source_evidence_refs: [currentRef, priorRef],
      schema_descriptor: { predicate: "跨角色偷渡", object_ref: "不得混用別人的私有經驗", qualifiers: [] },
      evidence_groundings: [
        { evidence_ref: currentRef, experience_index: 1, grounding_fields: ["action", "perceived_result"] },
        { evidence_ref: priorRef, experience_index: 0, grounding_fields: ["action", "perceived_result"] },
      ],
    }],
  }),
  (error) => error?.code === "WORLD_SIMULATION_RELATIONAL_SCHEMA_INDUCTION_CHARACTER_INVALID",
  "Phase77B must fail closed when internal Phase77A lineage does not belong to the proposal character.",
);

const tamperedEvidence = structuredClone(evidence);
tamperedEvidence.resolver_view.character_contexts[0].current_anchor_evidence[0]
  .bounded_experiences[0].action = "竄改後的行動";
assert.throws(
  () => buildWorldSimulationRelationalSchemaInductionResolverView({
    multi_experience_schema_evidence: tamperedEvidence,
  }),
  (error) => error?.code === "WORLD_SIMULATION_RELATIONAL_SCHEMA_INDUCTION_PHASE77A_HASH_MISMATCH",
  "Phase77B must fail closed when its exact Phase77A evidence projection has been altered.",
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
const phase77aIndex = loopSource.indexOf("const multiExperienceSchemaEvidence =");
const phase77bIndex = loopSource.indexOf("const relationalSchemaInductionResolverView =", phase77aIndex);
const phase67cIndex = loopSource.indexOf("const personalSemanticDecisionResolution =", phase77bIndex);
assert.ok(
  phase77aIndex >= 0 && phase77bIndex > phase77aIndex && phase67cIndex > phase77bIndex,
  "Phase77B must run after exact Phase77A evidence assembly and before Phase67C durable semantic authority.",
);
assert.match(loopSource, /relationalSchemaInductionResolver/);
assert.match(loopSource, /relational_schema_induction:/);
assert.match(stateSource, /relational_schema_induction:/);
assert.match(loopSource, /durable_semantic_write_performed:\s*false/);
assert.match(loopSource, /phase77c_promotion_owner:\s*true/);
assert.match(loopSource, /systematicity_action_result_grounding_required:\s*true/);
assert.match(loopSource, /surface_similarity_alone_is_sufficient:\s*false/);
assert.match(loopSource, /same_turn_character_brain_feedback_allowed:\s*false/);

console.log("Phase77B relational schema induction tests passed.");
