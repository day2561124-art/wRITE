import assert from "node:assert/strict";

import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import {
  worldSimulationAnalogicalExperienceApplicationLineageVersion,
} from "../../server/src/world-simulation-analogical-experience-application-lineage-service.mjs";
import {
  worldSimulationExperientialMethodOutcomeCreditVersion,
} from "../../server/src/world-simulation-experiential-method-outcome-credit-service.mjs";
import {
  assertWorldSimulationAnalogicalExperienceOutcomeEvidence,
  buildWorldSimulationAnalogicalExperienceOutcomeEvidence,
  buildWorldSimulationAnalogicalExperienceOutcomeEvidenceContract,
  worldSimulationAnalogicalExperienceOutcomeEvidenceVersion,
} from "../../server/src/world-simulation-analogical-experience-outcome-evidence-service.mjs";

const sessionId = "session_phase80e";
const turnId = "turn_phase80e";
const stateRevision = 37;
const worldStateHash = "world_state_hash_phase80e";
const character = "千夜";
const phase76FReceiptId = "phase76f_application_phase80e";
const phase76FReceiptHash = "phase76f_application_hash_phase80e";
const actionId = "action_phase80e";
const actionRef = "phase74a_action_phase80e";
const methodRef = "phase76e_transfer_phase80e";

function hashed(value, field) {
  const result = structuredClone(value);
  result[field] = hashAgentRunValue(result);
  return result;
}

function makePhase80D() {
  const identity = {
    version: worldSimulationAnalogicalExperienceApplicationLineageVersion,
    world_simulation_session_id: sessionId,
    turn_id: turnId,
    state_revision: stateRevision,
    world_state_hash: worldStateHash,
    character,
    phase80c_projection_hash: "phase80c_hash_phase80e",
    source_phase80a_projection_hash: "phase80a_hash_phase80e",
    source_phase80b_adaptation_hash: "phase80b_hash_phase80e",
    analogy_candidate_ref: "phase80a_analogy_phase80e",
    current_impasse_ref: "phase79d_impasse_phase80e",
    current_corresponding_method_ref: methodRef,
    phase76f_application_receipt_id: phase76FReceiptId,
    phase76f_application_receipt_hash: phase76FReceiptHash,
    action_id: actionId,
    action_ref: actionRef,
  };
  const receiptHash = hashAgentRunValue(identity);
  const receipt = {
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
  };
  return hashed({
    version: worldSimulationAnalogicalExperienceApplicationLineageVersion,
    world_simulation_session_id: sessionId,
    turn_id: turnId,
    state_revision: stateRevision,
    world_state_hash: worldStateHash,
    source_phase76f_receipt_bundle_hash: "phase76f_bundle_hash_phase80e",
    source_phase80c_projection_hashes: [identity.phase80c_projection_hash],
    receipt_count: 1,
    receipts: [receipt],
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

function makePhase76G(assessment = "supports_prior_method", overrides = {}) {
  const assessmentIdentity = {
    version: worldSimulationExperientialMethodOutcomeCreditVersion,
    turn_id: turnId,
    application_ref: actionRef,
    phase76f_application_receipt_id: phase76FReceiptId,
    phase76f_application_receipt_hash: phase76FReceiptHash,
    assessment,
  };
  const assessmentHash = hashAgentRunValue(assessmentIdentity);
  const record = {
    assessment_ref: `phase76g_credit_${assessmentHash.slice(0, 24)}`,
    assessment_hash: assessmentHash,
    ...assessmentIdentity,
    character,
    action_id: actionId,
    outcome_basis: "bounded_subjective_post_outcome_experience",
    objective_causation_claimed: false,
    numeric_credit_assigned: false,
    subjective_not_world_truth: true,
  };
  return hashed({
    version: worldSimulationExperientialMethodOutcomeCreditVersion,
    turn_id: turnId,
    source_phase76f_receipt_bundle_hash: "phase76f_bundle_hash_phase80e",
    source_phase76b_bridge_hash: "phase76b_bridge_hash_phase80e",
    resolver_view_hash: "phase76g_resolver_hash_phase80e",
    assessment_count: 1,
    assessments: [record],
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
    ...overrides,
  }, "projection_hash");
}

const contract = buildWorldSimulationAnalogicalExperienceOutcomeEvidenceContract();
assert.equal(contract.phase, "Phase80E");
assert.equal(contract.source_adapted_application_lineage_owner, "Phase80D");
assert.equal(contract.source_subjective_outcome_owner, "Phase76G");
assert.equal(contract.full_phase80a_b_c_d_provenance_preserved, true);
assert.equal(contract.adaptation_success_inferred, false);
assert.equal(contract.analogy_validity_inferred, false);
assert.equal(contract.causal_credit_assigned, false);
assert.equal(contract.semantic_retention_performed, false);
assert.equal(contract.world_truth_authority_claimed, false);

const phase80D = makePhase80D();
const phase76G = makePhase76G();
const evidence = buildWorldSimulationAnalogicalExperienceOutcomeEvidence({
  world_simulation_session_id: sessionId,
  turn_id: turnId,
  state_revision: stateRevision,
  world_state_hash: worldStateHash,
  analogical_experience_application_lineage: phase80D,
  experiential_method_outcome_credit: phase76G,
});
assert.equal(evidence.version, worldSimulationAnalogicalExperienceOutcomeEvidenceVersion);
assert.equal(evidence.source_phase80d_receipt_bundle_hash, phase80D.receipt_bundle_hash);
assert.equal(evidence.source_phase76g_projection_hash, phase76G.projection_hash);
assert.equal(evidence.evidence_count, 1);
const record = evidence.evidence_records[0];
assert.equal(record.phase80d_lineage_receipt_id, phase80D.receipts[0].receipt_id);
assert.equal(record.phase80c_projection_hash, phase80D.receipts[0].phase80c_projection_hash);
assert.equal(record.source_phase80a_projection_hash, phase80D.receipts[0].source_phase80a_projection_hash);
assert.equal(record.source_phase80b_adaptation_hash, phase80D.receipts[0].source_phase80b_adaptation_hash);
assert.equal(record.current_corresponding_method_ref, methodRef);
assert.equal(record.phase76g_assessment_ref, phase76G.assessments[0].assessment_ref);
assert.equal(record.method_outcome_assessment, "supports_prior_method");
assert.equal(record.outcome_evidence_kind, "adapted_analogy_method_supported_by_subjective_outcome");
assert.equal(record.selected_application_method_identity_preserved, true);
assert.equal(record.subjective_outcome_not_world_truth, true);
assert.equal(record.adaptation_success_inferred, false);
assert.equal(record.analogy_validity_inferred, false);
assert.equal(record.comparative_superiority_inferred, false);
assert.equal(record.causal_credit_assigned, false);
assert.equal(record.preference_retention_performed, false);
assert.equal(record.semantic_retention_performed, false);
assert.equal(record.semantic_revision_performed, false);
assert.equal(record.world_truth_authority, false);
assert.doesNotThrow(() => assertWorldSimulationAnalogicalExperienceOutcomeEvidence(evidence, {
  world_simulation_session_id: sessionId,
  turn_id: turnId,
  state_revision: stateRevision,
  world_state_hash: worldStateHash,
}));

for (const [assessment, expectedKind] of [
  ["counterevidence_for_prior_method", "adapted_analogy_method_counterevidenced_by_subjective_outcome"],
  ["ambiguous_no_revision", "adapted_analogy_method_outcome_ambiguous"],
]) {
  const projected = buildWorldSimulationAnalogicalExperienceOutcomeEvidence({
    world_simulation_session_id: sessionId,
    turn_id: turnId,
    state_revision: stateRevision,
    world_state_hash: worldStateHash,
    analogical_experience_application_lineage: phase80D,
    experiential_method_outcome_credit: makePhase76G(assessment),
  });
  assert.equal(projected.evidence_records[0].outcome_evidence_kind, expectedKind);
  assert.equal(projected.evidence_records[0].semantic_retention_performed, false);
}

const noAssessment = makePhase76G();
noAssessment.assessments = [];
noAssessment.assessment_count = 0;
delete noAssessment.projection_hash;
noAssessment.projection_hash = hashAgentRunValue(noAssessment);
const emptyEvidence = buildWorldSimulationAnalogicalExperienceOutcomeEvidence({
  world_simulation_session_id: sessionId,
  turn_id: turnId,
  state_revision: stateRevision,
  world_state_hash: worldStateHash,
  analogical_experience_application_lineage: phase80D,
  experiential_method_outcome_credit: noAssessment,
});
assert.equal(emptyEvidence.evidence_count, 0);
assert.equal(emptyEvidence.persistence_boundary.retention_deferred, true);

const wrongReceipt = makePhase76G();
wrongReceipt.assessments[0].phase76f_application_receipt_hash = "tampered";
const tamperedIdentity = {
  version: wrongReceipt.assessments[0].version,
  turn_id: wrongReceipt.assessments[0].turn_id,
  application_ref: wrongReceipt.assessments[0].application_ref,
  phase76f_application_receipt_id: wrongReceipt.assessments[0].phase76f_application_receipt_id,
  phase76f_application_receipt_hash: wrongReceipt.assessments[0].phase76f_application_receipt_hash,
  assessment: wrongReceipt.assessments[0].assessment,
};
const tamperedHash = hashAgentRunValue(tamperedIdentity);
wrongReceipt.assessments[0].assessment_hash = tamperedHash;
wrongReceipt.assessments[0].assessment_ref = `phase76g_credit_${tamperedHash.slice(0, 24)}`;
delete wrongReceipt.projection_hash;
wrongReceipt.projection_hash = hashAgentRunValue(wrongReceipt);
assert.throws(
  () => buildWorldSimulationAnalogicalExperienceOutcomeEvidence({
    world_simulation_session_id: sessionId,
    turn_id: turnId,
    state_revision: stateRevision,
    world_state_hash: worldStateHash,
    analogical_experience_application_lineage: phase80D,
    experiential_method_outcome_credit: wrongReceipt,
  }),
  (error) => error?.code === "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_OUTCOME_EVIDENCE_SOURCE_MISMATCH",
);

const boundaryViolation = makePhase76G();
boundaryViolation.audit.hidden_causal_evidence_consumed = true;
delete boundaryViolation.projection_hash;
boundaryViolation.projection_hash = hashAgentRunValue(boundaryViolation);
assert.throws(
  () => buildWorldSimulationAnalogicalExperienceOutcomeEvidence({
    world_simulation_session_id: sessionId,
    turn_id: turnId,
    state_revision: stateRevision,
    world_state_hash: worldStateHash,
    analogical_experience_application_lineage: phase80D,
    experiential_method_outcome_credit: boundaryViolation,
  }),
  (error) => error?.code === "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_OUTCOME_EVIDENCE_PHASE76G_BOUNDARY_INVALID",
);

console.log("Phase80E adapted analogy subjective outcome evidence tests passed.");
