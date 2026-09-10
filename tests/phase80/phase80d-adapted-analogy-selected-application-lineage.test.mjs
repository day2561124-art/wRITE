import assert from "node:assert/strict";

import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import {
  worldSimulationAnalogicalExperienceRevalidationVersion,
} from "../../server/src/world-simulation-analogical-experience-revalidation-service.mjs";
import {
  worldSimulationExperientialMethodApplicationLineageVersion,
} from "../../server/src/world-simulation-experiential-method-application-lineage-service.mjs";
import {
  assertWorldSimulationAnalogicalExperienceApplicationLineageBundle,
  buildWorldSimulationAnalogicalExperienceApplicationLineage,
  buildWorldSimulationAnalogicalExperienceApplicationLineageContract,
  worldSimulationAnalogicalExperienceApplicationLineageVersion,
} from "../../server/src/world-simulation-analogical-experience-application-lineage-service.mjs";

const sessionId = "session_phase80d";
const turnId = "turn_phase80d";
const stateRevision = 31;
const worldStateHash = "world_state_hash_phase80d";
const character = "千夜";
const methodRef = "phase76e_transfer_phase80d";
const analogyRef = "phase80a_analogy_phase80d";
const impasseRef = "phase79d_impasse_phase80d";
const actionId = "action_phase80d";
const actionRef = "phase74a_action_phase80d";

function hashed(value, field) {
  const result = structuredClone(value);
  result[field] = hashAgentRunValue(result);
  return result;
}

function makePhase80C(overrides = {}) {
  const projection = {
    version: worldSimulationAnalogicalExperienceRevalidationVersion,
    character,
    current_turn_id: turnId,
    current_state_revision: stateRevision,
    current_world_state_hash: worldStateHash,
    source_phase79d_impasse_hash: "phase79d_hash_phase80d",
    source_phase79e_evidence_hash: "phase79e_hash_phase80d",
    source_phase80a_projection_hash: "phase80a_hash_phase80d",
    source_phase80b_adaptation_hash: "phase80b_hash_phase80d",
    revalidated_method_count: 1,
    revalidated_adapted_methods: [{
      analogy_candidate_ref: analogyRef,
      current_impasse_ref: impasseRef,
      current_corresponding_method_ref: methodRef,
      method_skeleton: {
        trigger_relation: "blocked_path_requires_detour",
        response_relation: "seek_alternate_passage",
      },
      source_knowledge_status: "supported",
      mapping_kind: "relational_method_transfer",
      current_context_basis: [{
        cue_kind: "perception",
        content: { route: "narrow corridor" },
        adaptation_role: "retained_alignment",
        same_turn_character_visible_context: true,
        world_truth_authority: false,
      }],
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
    ...overrides,
  };
  projection.character_view.adapted_methods = structuredClone(
    projection.revalidated_adapted_methods,
  );
  return hashed(projection, "projection_hash");
}

function makePhase76FApplication(appliedMethodRefs = [methodRef]) {
  const receiptIdentity = {
    version: worldSimulationExperientialMethodApplicationLineageVersion,
    world_simulation_session_id: sessionId,
    turn_id: turnId,
    state_revision: stateRevision,
    world_state_hash: worldStateHash,
    character,
    selection_kind: "candidate_action_intent",
    action_id: actionId,
    action_ref: actionRef,
    phase74d_choice_receipt_id: "phase74d_choice_phase80d",
    phase74d_choice_receipt_hash: "phase74d_choice_hash_phase80d",
    source_phase76f_projection_hash: "phase76f_projection_hash_phase80d",
    source_phase76e_transfer_hash: "phase76e_transfer_hash_phase80d",
    candidate_attribution_refs: ["phase76f_candidate_phase80d"],
    applied_method_refs: appliedMethodRefs,
  };
  const receiptHash = hashAgentRunValue(receiptIdentity);
  const receipt = {
    receipt_id: `phase76f_application_${receiptHash.slice(0, 24)}`,
    receipt_hash: receiptHash,
    ...receiptIdentity,
    application_status: "selected_candidate_has_recorded_experiential_method_attribution",
    selected_application_means_attributed_candidate_was_selected_only: true,
    method_caused_candidate_claimed: false,
    method_caused_selection_claimed: false,
    outcome_observed_by_this_receipt: false,
    action_outcome_credit_assigned: false,
    success_failure_learning_performed: false,
    retain_revise_decision_performed: false,
    world_truth_authority: false,
    causal_outcome_authority: false,
  };
  return hashed({
    version: worldSimulationExperientialMethodApplicationLineageVersion,
    world_simulation_session_id: sessionId,
    turn_id: turnId,
    state_revision: stateRevision,
    world_state_hash: worldStateHash,
    source_phase74d_receipt_bundle_hash: "phase74d_bundle_hash_phase80d",
    receipt_count: 1,
    receipts: [receipt],
    persistence_boundary: {
      persist_only_with_successful_atomic_world_turn_commit: true,
      blocked_or_failed_turn_persists_receipt: false,
      append_only_world_history_is_authoritative: true,
      receipt_does_not_mutate_world_state: true,
      action_outcome_not_consumed: true,
      causal_credit_not_assigned: true,
    },
  }, "receipt_bundle_hash");
}

const contract = buildWorldSimulationAnalogicalExperienceApplicationLineageContract();
assert.equal(contract.phase, "Phase80D");
assert.equal(contract.source_adaptation_owner, "Phase80C");
assert.equal(contract.source_selected_application_owner, "Phase76F");
assert.equal(contract.selected_application_method_identity_must_match_revalidated_method, true);
assert.equal(contract.phase80c_caused_candidate_claimed, false);
assert.equal(contract.phase80c_caused_selection_claimed, false);
assert.equal(contract.action_outcome_consumed, false);
assert.equal(contract.outcome_credit_assigned, false);
assert.equal(contract.retain_revise_decision_performed, false);
assert.equal(contract.world_truth_authority_claimed, false);

const phase80C = makePhase80C();
const application = makePhase76FApplication();
const lineage = buildWorldSimulationAnalogicalExperienceApplicationLineage({
  world_simulation_session_id: sessionId,
  turn_id: turnId,
  state_revision: stateRevision,
  world_state_hash: worldStateHash,
  analogical_experience_revalidation_projections: [phase80C],
  selected_application_receipts: application,
});
assert.equal(lineage.version, worldSimulationAnalogicalExperienceApplicationLineageVersion);
assert.equal(lineage.receipt_count, 1);
assert.deepEqual(lineage.source_phase80c_projection_hashes, [phase80C.projection_hash]);
assert.equal(lineage.source_phase76f_receipt_bundle_hash, application.receipt_bundle_hash);
const receipt = lineage.receipts[0];
assert.equal(receipt.phase80c_projection_hash, phase80C.projection_hash);
assert.equal(receipt.source_phase80a_projection_hash, phase80C.source_phase80a_projection_hash);
assert.equal(receipt.source_phase80b_adaptation_hash, phase80C.source_phase80b_adaptation_hash);
assert.equal(receipt.analogy_candidate_ref, analogyRef);
assert.equal(receipt.current_impasse_ref, impasseRef);
assert.equal(receipt.current_corresponding_method_ref, methodRef);
assert.equal(receipt.action_id, actionId);
assert.equal(receipt.action_ref, actionRef);
assert.equal(receipt.selected_application_method_identity_matches_revalidated_adapted_method, true);
assert.equal(receipt.revalidated_guidance_caused_candidate_claimed, false);
assert.equal(receipt.revalidated_guidance_caused_selection_claimed, false);
assert.equal(receipt.action_outcome_observed, false);
assert.equal(receipt.outcome_credit_assigned, false);
assert.equal(receipt.retain_revise_decision_performed, false);
assert.equal(receipt.semantic_retention_performed, false);
assert.equal(receipt.world_truth_authority, false);
assert.doesNotThrow(() => assertWorldSimulationAnalogicalExperienceApplicationLineageBundle(lineage, {
  world_simulation_session_id: sessionId,
  turn_id: turnId,
  state_revision: stateRevision,
  world_state_hash: worldStateHash,
}));

const unrelatedApplication = makePhase76FApplication(["phase76e_other_method"]);
const noMatch = buildWorldSimulationAnalogicalExperienceApplicationLineage({
  world_simulation_session_id: sessionId,
  turn_id: turnId,
  state_revision: stateRevision,
  world_state_hash: worldStateHash,
  analogical_experience_revalidation_projections: [phase80C],
  selected_application_receipts: unrelatedApplication,
});
assert.equal(noMatch.receipt_count, 0);
assert.equal(noMatch.persistence_boundary.outcome_credit_not_assigned, true);
assert.equal(noMatch.persistence_boundary.retain_revise_decision_not_performed, true);

const wrongWorld = makePhase80C({ current_world_state_hash: "different_world_hash" });
assert.throws(
  () => buildWorldSimulationAnalogicalExperienceApplicationLineage({
    world_simulation_session_id: sessionId,
    turn_id: turnId,
    state_revision: stateRevision,
    world_state_hash: worldStateHash,
    analogical_experience_revalidation_projections: [wrongWorld],
    selected_application_receipts: application,
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_APPLICATION_LINEAGE_PHASE80C_WORLD_LINEAGE_MISMATCH",
);

const authorityViolation = makePhase80C();
authorityViolation.character_view.selected_action_authority = true;
delete authorityViolation.projection_hash;
authorityViolation.projection_hash = hashAgentRunValue(authorityViolation);
assert.throws(
  () => buildWorldSimulationAnalogicalExperienceApplicationLineage({
    world_simulation_session_id: sessionId,
    turn_id: turnId,
    state_revision: stateRevision,
    world_state_hash: worldStateHash,
    analogical_experience_revalidation_projections: [authorityViolation],
    selected_application_receipts: application,
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_APPLICATION_LINEAGE_PHASE80C_BOUNDARY_INVALID",
);

console.log("Phase80D adapted analogy selected-application lineage tests passed.");
