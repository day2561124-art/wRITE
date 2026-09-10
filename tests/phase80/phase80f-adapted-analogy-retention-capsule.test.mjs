import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import {
  worldSimulationAnalogicalExperienceApplicationLineageVersion,
} from "../../server/src/world-simulation-analogical-experience-application-lineage-service.mjs";
import {
  worldSimulationAnalogicalExperienceRevalidationVersion,
} from "../../server/src/world-simulation-analogical-experience-revalidation-service.mjs";
import {
  buildWorldSimulationAnalogicalExperienceOutcomeEvidence,
} from "../../server/src/world-simulation-analogical-experience-outcome-evidence-service.mjs";
import {
  worldSimulationExperientialMethodOutcomeCreditVersion,
} from "../../server/src/world-simulation-experiential-method-outcome-credit-service.mjs";
import {
  assertWorldSimulationAnalogicalExperienceRetentionCapsules,
  buildWorldSimulationAnalogicalExperienceRetentionCapsuleContract,
  buildWorldSimulationAnalogicalExperienceRetentionCapsules,
  worldSimulationAnalogicalExperienceRetentionCapsuleVersion,
} from "../../server/src/world-simulation-analogical-experience-retention-capsule-service.mjs";

const sessionId = "session_phase80f";
const turnId = "turn_phase80f";
const stateRevision = 41;
const worldStateHash = "world_state_hash_phase80f";
const character = "千夜";
const phase80AHash = "phase80a_hash_phase80f";
const phase80BHash = "phase80b_hash_phase80f";
const analogyRef = "phase80a_analogy_phase80f";
const impasseRef = "phase79d_impasse_phase80f";
const methodRef = "phase76e_transfer_phase80f";
const phase76FReceiptId = "phase76f_application_phase80f";
const phase76FReceiptHash = "phase76f_application_hash_phase80f";
const actionId = "action_phase80f";
const actionRef = "phase74a_action_phase80f";

function hashed(value, field) {
  const result = structuredClone(value);
  result[field] = hashAgentRunValue(result);
  return result;
}

function makePhase80C() {
  return hashed({
    version: worldSimulationAnalogicalExperienceRevalidationVersion,
    character,
    current_turn_id: turnId,
    current_state_revision: stateRevision,
    current_world_state_hash: worldStateHash,
    source_phase79d_impasse_hash: "phase79d_hash_phase80f",
    source_phase79e_evidence_hash: "phase79e_hash_phase80f",
    source_phase80a_projection_hash: phase80AHash,
    source_phase80b_adaptation_hash: phase80BHash,
    revalidated_method_count: 1,
    revalidated_adapted_methods: [{
      analogy_candidate_ref: analogyRef,
      current_impasse_ref: impasseRef,
      current_corresponding_method_ref: methodRef,
      method_skeleton: {
        relation: "approach_with_cover",
        method_ref: "method_skeleton_phase80f",
        qualifiers: ["protect_ally"],
      },
      source_knowledge_status: "supported",
      mapping_kind: "experiential_method",
      current_context_basis: [
        {
          cue_kind: "goal",
          content: { goal: "protect_ally" },
          adaptation_role: "retained_alignment",
          same_turn_character_visible_context: true,
          world_truth_authority: false,
        },
        {
          cue_kind: "pressure",
          content: { pressure: "narrow_corridor" },
          adaptation_role: "incorporated_difference",
          same_turn_character_visible_context: true,
          world_truth_authority: false,
        },
      ],
      current_context_revalidated: true,
      adaptation_difference_addressed: true,
      structural_method_identity_preserved: true,
      historical_surface_case_replayed: false,
      historical_method_semantics_copied: false,
      advisory_only: true,
      candidate_action_generation_deferred_to_existing_action_proposer: true,
      preference_selected: false,
      action_selected: false,
      world_truth_authority: false,
    }],
    character_view: {
      source: "revalidated_difference_aware_analogical_method_guidance",
      adapted_methods: [],
      current_context_revalidated: true,
      advisory_only: true,
      candidate_action_generation_owner: "existing_world_action_proposer",
      preference_authority: false,
      selected_action_authority: false,
      semantic_revision_authority: false,
      world_truth_authority: false,
    },
    audit: {
      exact_phase79d_source_verified: true,
      exact_phase79e_source_verified: true,
      exact_phase80a_source_verified: true,
      exact_phase80b_source_verified: true,
      same_character_same_turn_lineage_verified: true,
      current_corresponding_method_identity_reverified: true,
      selected_current_cue_refs_reverified: true,
      current_method_semantics_reused_from_phase79d_only: true,
      dropped_historical_cues_exposed_as_current_context: false,
      additional_resolver_used: false,
      resolver_authored_semantic_method_content: false,
      preference_resolution_performed: false,
      action_selection_performed: false,
      direct_plan_goal_belief_current_mind_world_mutation_performed: false,
      numeric_similarity_confidence_probability_utility_reward_modeled: false,
      fuzzy_semantic_similarity_used: false,
      world_truth_authority_claimed: false,
    },
  }, "projection_hash");
}

function makePhase80D(phase80C) {
  const identity = {
    version: worldSimulationAnalogicalExperienceApplicationLineageVersion,
    world_simulation_session_id: sessionId,
    turn_id: turnId,
    state_revision: stateRevision,
    world_state_hash: worldStateHash,
    character,
    phase80c_projection_hash: phase80C.projection_hash,
    source_phase80a_projection_hash: phase80AHash,
    source_phase80b_adaptation_hash: phase80BHash,
    analogy_candidate_ref: analogyRef,
    current_impasse_ref: impasseRef,
    current_corresponding_method_ref: methodRef,
    phase76f_application_receipt_id: phase76FReceiptId,
    phase76f_application_receipt_hash: phase76FReceiptHash,
    action_id: actionId,
    action_ref: actionRef,
  };
  const receiptHash = hashAgentRunValue(identity);
  return hashed({
    version: worldSimulationAnalogicalExperienceApplicationLineageVersion,
    world_simulation_session_id: sessionId,
    turn_id: turnId,
    state_revision: stateRevision,
    world_state_hash: worldStateHash,
    source_phase76f_receipt_bundle_hash: "phase76f_bundle_hash_phase80f",
    source_phase80c_projection_hashes: [phase80C.projection_hash],
    receipt_count: 1,
    receipts: [{
      receipt_id: `phase80d_application_${receiptHash.slice(0, 24)}`,
      receipt_hash: receiptHash,
      ...identity,
      selected_application_method_identity_matches_revalidated_adapted_method: true,
      revalidated_guidance_caused_candidate_claimed: false,
      revalidated_guidance_caused_selection_claimed: false,
      method_caused_selection_claimed: false,
      action_outcome_observed: false,
      outcome_credit_assigned: false,
      success_failure_learning_performed: false,
      retain_revise_decision_performed: false,
      semantic_retention_performed: false,
      semantic_revision_performed: false,
      world_truth_authority: false,
    }],
    persistence_boundary: {
      persist_only_with_successful_atomic_world_turn_commit: true,
      blocked_or_failed_turn_persists_receipt: false,
      receipt_does_not_mutate_world_state: true,
      action_outcome_not_consumed: true,
      outcome_credit_not_assigned: true,
      retain_revise_decision_not_performed: true,
      semantic_retention_not_performed: true,
    },
  }, "receipt_bundle_hash");
}

function makePhase76G(assessment = "supports_prior_method") {
  const identity = {
    version: worldSimulationExperientialMethodOutcomeCreditVersion,
    turn_id: turnId,
    application_ref: actionRef,
    phase76f_application_receipt_id: phase76FReceiptId,
    phase76f_application_receipt_hash: phase76FReceiptHash,
    assessment,
  };
  const assessmentHash = hashAgentRunValue(identity);
  return hashed({
    version: worldSimulationExperientialMethodOutcomeCreditVersion,
    turn_id: turnId,
    source_phase76f_receipt_bundle_hash: "phase76f_bundle_hash_phase80f",
    source_phase76b_bridge_hash: "phase76b_bridge_hash_phase80f",
    resolver_view_hash: "phase76g_resolver_hash_phase80f",
    assessment_count: 1,
    assessments: [{
      assessment_ref: `phase76g_credit_${assessmentHash.slice(0, 24)}`,
      assessment_hash: assessmentHash,
      ...identity,
      character,
      action_id: actionId,
      outcome_basis: "bounded_subjective_post_outcome_experience",
      objective_causation_claimed: false,
      numeric_credit_assigned: false,
      subjective_not_world_truth: true,
    }],
    semantic_decision_count: 0,
    semantic_decisions: [],
    audit: {
      exact_phase76f_application_receipts_verified: true,
      exact_phase76b_subjective_experience_verified: true,
      raw_action_outcome_consumed: false,
      hidden_causal_evidence_consumed: false,
      objective_causation_claimed: false,
      success_auto_credits_method: false,
      failure_auto_discredits_method: false,
      numeric_reward_q_value_success_rate_modeled: false,
      parallel_semantic_store_created: false,
      same_turn_character_brain_feedback: false,
    },
  }, "projection_hash");
}

const contract = buildWorldSimulationAnalogicalExperienceRetentionCapsuleContract();
assert.equal(contract.phase, "Phase80F");
assert.equal(contract.only_applied_and_subjectively_evaluated_adaptations_retained, true);
assert.equal(contract.adapted_current_context_basis_retained, true);
assert.equal(contract.supported_counterevidenced_and_ambiguous_cases_retained, true);
assert.equal(contract.automatic_preference_learning_performed, false);
assert.equal(contract.semantic_method_revision_performed, false);
assert.equal(contract.world_truth_authority_claimed, false);
assert.equal(contract.same_turn_reentry_allowed, false);

const phase80C = makePhase80C();
const phase80D = makePhase80D(phase80C);
const phase80E = buildWorldSimulationAnalogicalExperienceOutcomeEvidence({
  world_simulation_session_id: sessionId,
  turn_id: turnId,
  state_revision: stateRevision,
  world_state_hash: worldStateHash,
  analogical_experience_application_lineage: phase80D,
  experiential_method_outcome_credit: makePhase76G(),
});
const retained = buildWorldSimulationAnalogicalExperienceRetentionCapsules({
  world_simulation_session_id: sessionId,
  turn_id: turnId,
  state_revision: stateRevision,
  world_state_hash: worldStateHash,
  analogical_experience_outcome_evidence: phase80E,
  analogical_experience_revalidation_projections: [phase80C],
});
assert.equal(retained.version, worldSimulationAnalogicalExperienceRetentionCapsuleVersion);
assert.equal(retained.capsule_count, 1);
assert.equal(retained.source_phase80e_projection_hash, phase80E.projection_hash);
const capsule = retained.capsules[0];
assert.equal(capsule.source_phase80c_projection_hash, phase80C.projection_hash);
assert.equal(capsule.analogy_candidate_ref, analogyRef);
assert.equal(capsule.current_corresponding_method_ref, methodRef);
assert.deepEqual(capsule.method_skeleton, phase80C.revalidated_adapted_methods[0].method_skeleton);
assert.equal(capsule.adapted_current_context_basis.length, 2);
assert.deepEqual(
  new Set(capsule.adapted_current_context_basis.map((cue) => cue.adaptation_role)),
  new Set(["retained_alignment", "incorporated_difference"]),
);
assert.equal(capsule.method_outcome_assessment, "supports_prior_method");
assert.equal(capsule.subjective_outcome_not_world_truth, true);
assert.equal(capsule.comparative_superiority_inferred, false);
assert.equal(capsule.causal_credit_assigned, false);
assert.equal(capsule.automatic_preference_learning_performed, false);
assert.equal(capsule.semantic_method_revision_performed, false);
assert.equal(capsule.same_turn_reentry_allowed, false);
assert.doesNotThrow(() => assertWorldSimulationAnalogicalExperienceRetentionCapsules(retained, {
  world_simulation_session_id: sessionId,
  turn_id: turnId,
  state_revision: stateRevision,
  world_state_hash: worldStateHash,
}));

for (const assessment of ["counterevidence_for_prior_method", "ambiguous_no_revision"]) {
  const source = buildWorldSimulationAnalogicalExperienceOutcomeEvidence({
    world_simulation_session_id: sessionId,
    turn_id: turnId,
    state_revision: stateRevision,
    world_state_hash: worldStateHash,
    analogical_experience_application_lineage: phase80D,
    experiential_method_outcome_credit: makePhase76G(assessment),
  });
  const projection = buildWorldSimulationAnalogicalExperienceRetentionCapsules({
    world_simulation_session_id: sessionId,
    turn_id: turnId,
    state_revision: stateRevision,
    world_state_hash: worldStateHash,
    analogical_experience_outcome_evidence: source,
    analogical_experience_revalidation_projections: [phase80C],
  });
  assert.equal(projection.capsules[0].method_outcome_assessment, assessment);
  assert.equal(projection.capsules[0].automatic_preference_learning_performed, false);
}

const wrongPhase80C = structuredClone(phase80C);
wrongPhase80C.source_phase80b_adaptation_hash = "tampered";
delete wrongPhase80C.projection_hash;
wrongPhase80C.projection_hash = hashAgentRunValue(wrongPhase80C);
assert.throws(
  () => buildWorldSimulationAnalogicalExperienceRetentionCapsules({
    world_simulation_session_id: sessionId,
    turn_id: turnId,
    state_revision: stateRevision,
    world_state_hash: worldStateHash,
    analogical_experience_outcome_evidence: phase80E,
    analogical_experience_revalidation_projections: [wrongPhase80C],
  }),
  (error) => error?.code === "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_RETENTION_CAPSULE_SOURCE_MISMATCH",
);

const authorityEscalatedPhase80C = structuredClone(phase80C);
authorityEscalatedPhase80C.audit.preference_resolution_performed = true;
delete authorityEscalatedPhase80C.projection_hash;
authorityEscalatedPhase80C.projection_hash = hashAgentRunValue(authorityEscalatedPhase80C);
assert.throws(
  () => buildWorldSimulationAnalogicalExperienceRetentionCapsules({
    world_simulation_session_id: sessionId,
    turn_id: turnId,
    state_revision: stateRevision,
    world_state_hash: worldStateHash,
    analogical_experience_outcome_evidence: phase80E,
    analogical_experience_revalidation_projections: [authorityEscalatedPhase80C],
  }),
  (error) => error?.code === "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_RETENTION_CAPSULE_PHASE80C_BOUNDARY_INVALID",
);

const nonCanonicalCapsules = structuredClone(retained);
nonCanonicalCapsules.capsules[0].adapted_current_context_basis[0].cue_content_hash = "tampered";
const nonCanonicalIdentity = structuredClone(nonCanonicalCapsules.capsules[0]);
for (const key of [
  "capsule_ref", "capsule_hash", "subjective_outcome_not_world_truth",
  "comparative_superiority_inferred", "causal_credit_assigned",
  "automatic_preference_learning_performed", "semantic_method_revision_performed",
  "same_turn_reentry_allowed",
]) delete nonCanonicalIdentity[key];
const nonCanonicalHash = hashAgentRunValue(nonCanonicalIdentity);
nonCanonicalCapsules.capsules[0].capsule_hash = nonCanonicalHash;
nonCanonicalCapsules.capsules[0].capsule_ref = `phase80f_retention_${nonCanonicalHash.slice(0, 24)}`;
delete nonCanonicalCapsules.projection_hash;
nonCanonicalCapsules.projection_hash = hashAgentRunValue(nonCanonicalCapsules);
assert.throws(
  () => assertWorldSimulationAnalogicalExperienceRetentionCapsules(nonCanonicalCapsules),
  (error) => error?.code === "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_RETENTION_CAPSULE_CONTEXT_INVALID",
);

const stateSource = await readFile("server/src/world-simulation-state-service.mjs", "utf8");
assert.match(stateSource, /analogical_experience_retention_capsules:\s*\r?\n\s*input\.analogical_experience_retention_capsules \?\? null/);

console.log("Phase80F adapted analogy retention capsule tests passed.");
