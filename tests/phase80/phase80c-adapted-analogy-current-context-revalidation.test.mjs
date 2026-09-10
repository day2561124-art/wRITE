import assert from "node:assert/strict";

import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import {
  worldSimulationExperientialMethodImpasseDeliberationVersion,
} from "../../server/src/world-simulation-experiential-method-impasse-deliberation-service.mjs";
import {
  worldSimulationExperientialMethodImpasseDiscriminatingEvidenceVersion,
} from "../../server/src/world-simulation-experiential-method-impasse-discriminating-evidence-service.mjs";
import {
  worldSimulationAnalogicalExperienceCandidateVersion,
} from "../../server/src/world-simulation-analogical-experience-candidate-service.mjs";
import {
  buildWorldSimulationAnalogicalExperienceAdaptationResolverView,
  projectWorldSimulationAnalogicalExperienceAdaptation,
} from "../../server/src/world-simulation-analogical-experience-adaptation-service.mjs";
import {
  buildWorldSimulationAnalogicalExperienceRevalidationContract,
  projectWorldSimulationAnalogicalExperienceRevalidation,
  worldSimulationAnalogicalExperienceRevalidationVersion,
} from "../../server/src/world-simulation-analogical-experience-revalidation-service.mjs";

const character = "千夜";
const turnId = "turn_phase80c_current";
const stateRevision = 19;
const worldStateHash = "world_state_hash_phase80c";
const impasseRef = "phase79d_impasse_phase80c";
const transferRef = "phase76e_transfer_phase80c";
const methodSkeleton = {
  trigger_relation: "blocked_path_requires_detour",
  response_relation: "seek_alternate_passage",
};
const methodSkeletonHash = hashAgentRunValue(methodSkeleton);

function hashed(value, field) {
  const projection = structuredClone(value);
  projection[field] = hashAgentRunValue(projection);
  return projection;
}

function makePhase79D() {
  return hashed({
    version: worldSimulationExperientialMethodImpasseDeliberationVersion,
    character,
    current_turn_id: turnId,
    source_phase79b_resolution_hash: "phase79b_hash_phase80c",
    source_phase79c_guidance_hash: "phase79c_hash_phase80c",
    impasse_contexts: [{
      impasse_ref: impasseRef,
      character,
      current_turn_id: turnId,
      source_resolution_ref: "phase79b_resolution_phase80c",
      impasse_type: "tie_impasse",
      retained_method_refs: [transferRef, "phase76e_transfer_other"],
      unresolved_competition_refs: ["competition_phase80c"],
      cyclic_preference_detected: false,
      candidate_methods: [{
        transfer_ref: transferRef,
        method_skeleton: methodSkeleton,
        source_knowledge_status: "supported",
        mapping_kind: "relational_method_transfer",
        current_context_basis: ["perception", "working_context"],
        current_context_grounded: true,
        advisory_only: true,
      }],
      deliberation_contract: {
        qualitative_resolution_only: true,
      },
    }],
    impasse_count: 1,
    deliberation_required: true,
    audit: { world_truth_authority_claimed: false },
  }, "impasse_hash");
}

function makePhase79E(phase79D) {
  return hashed({
    version: worldSimulationExperientialMethodImpasseDiscriminatingEvidenceVersion,
    character,
    current_turn_id: turnId,
    source_phase79d_impasse_hash: phase79D.impasse_hash,
    impasse_evidence_contexts: [{
      impasse_ref: impasseRef,
      impasse_type: "tie_impasse",
      retained_method_refs: [transferRef, "phase76e_transfer_other"],
      candidate_methods: structuredClone(phase79D.impasse_contexts[0].candidate_methods),
      unresolved_competition_refs: ["competition_phase80c"],
      current_context_cue_catalog: [{
        cue_ref: "current_route",
        cue_kind: "perception",
        content: { route: "narrow corridor" },
        current_turn_only: true,
        character_visible_context_only: true,
        world_truth_authority: false,
      }, {
        cue_ref: "current_threat",
        cue_kind: "working_context",
        content: { nearby_threat: "closing distance" },
        current_turn_only: true,
        character_visible_context_only: true,
        world_truth_authority: false,
      }],
      evidence_selection_contract: {
        select_only_from_current_context_cue_catalog: true,
      },
    }],
    impasse_count: 1,
    cue_count: 2,
    deliberation_evidence_available: true,
    audit: { world_truth_authority_claimed: false },
  }, "evidence_hash");
}

function makePhase80A(phase79E) {
  const identity = {
    version: worldSimulationAnalogicalExperienceCandidateVersion,
    source_phase79i_precedent_ref: "phase79i_precedent_phase80c",
    source_phase79i_precedent_hash: "phase79i_precedent_hash_phase80c",
    current_impasse_ref: impasseRef,
    source_turn_id: "turn_phase80c_history",
    source_revision_to: 12,
    historical_impasse_ref: "phase79d_impasse_phase80c_history",
    method_set_hash: "method_set_hash_phase80c",
    historical_dominant_method_skeleton_hash: methodSkeletonHash,
    current_corresponding_method_ref: transferRef,
    current_corresponding_method_skeleton_hash: methodSkeletonHash,
    method_outcome_assessment: "supports_prior_method",
    precedent_kind: "supported_resolution_selected_method_precedent",
    alignment_kind: "exact_method_structure_with_context_difference",
    aligned_cue_pairs: [{
      historical_cue_ref: "historical_route",
      current_cue_ref: "current_route",
      cue_kind: "perception",
      cue_content_hash: "cue_hash_route",
      exact_kind_and_content_alignment: true,
    }],
    historical_unmatched_cues: [{
      historical_cue_ref: "historical_visibility",
      cue_kind: "attention",
      content: { visibility: "open" },
      cue_content_hash: "cue_hash_visibility",
    }],
    current_additional_cues: [{
      current_cue_ref: "current_threat",
      cue_kind: "working_context",
      content: { nearby_threat: "closing distance" },
      cue_content_hash: "cue_hash_threat",
    }],
  };
  const candidateHash = hashAgentRunValue(identity);
  const candidate = {
    analogy_candidate_ref: `phase80a_analogy_${candidateHash.slice(0, 24)}`,
    analogy_candidate_hash: candidateHash,
    ...identity,
    aligned_cue_count: 1,
    historical_unmatched_cue_count: 1,
    current_additional_cue_count: 1,
    exact_method_structure_alignment: true,
    context_difference_present: true,
    adaptation_required: true,
    direct_reuse_allowed: false,
    comparative_preference_validated: false,
    automatic_preference_selected: false,
    action_selection_performed: false,
    semantic_revision_performed: false,
    world_truth_authority: false,
    source_current_state_revision: stateRevision,
  };
  const projection = {
    version: worldSimulationAnalogicalExperienceCandidateVersion,
    character,
    current_turn_id: turnId,
    current_state_revision: stateRevision,
    current_world_state_hash: worldStateHash,
    source_phase79e_evidence_hash: phase79E.evidence_hash,
    source_phase79i_precedent_reentry_hash: "phase79i_hash_phase80c",
    source_phase79i_precedent_count: 1,
    source_phase79i_exact_full_cue_match_count: 0,
    source_phase79i_near_miss_count: 1,
    analogy_candidate_count: 1,
    analogy_candidates: [candidate],
    audit: {
      character_brain_exposure_performed: false,
      fuzzy_semantic_similarity_used: false,
      numeric_similarity_confidence_probability_utility_reward_modeled: false,
      world_truth_authority_claimed: false,
    },
  };
  projection.projection_hash = hashAgentRunValue(projection);
  return projection;
}

function makeFixture() {
  const phase79D = makePhase79D();
  const phase79E = makePhase79E(phase79D);
  const phase80A = makePhase80A(phase79E);
  const view = buildWorldSimulationAnalogicalExperienceAdaptationResolverView({
    source_phase80a_projection: phase80A,
  });
  const candidate = view.analogy_candidates[0];
  const phase80B = projectWorldSimulationAnalogicalExperienceAdaptation({
    resolver_view: view,
    adaptation_decisions: [{
      analogy_candidate_ref: candidate.analogy_candidate_ref,
      retain_aligned_current_cue_refs: ["current_route"],
      drop_historical_cue_refs: ["historical_visibility"],
      incorporate_current_cue_refs: ["current_threat"],
    }],
  });
  return { phase79D, phase79E, phase80A, phase80B };
}

const contract = buildWorldSimulationAnalogicalExperienceRevalidationContract();
assert.equal(contract.version, worldSimulationAnalogicalExperienceRevalidationVersion);
assert.equal(contract.phase, "Phase80C");
assert.equal(contract.deterministic_revalidation_only, true);
assert.equal(contract.additional_resolver_required, false);
assert.equal(contract.current_method_semantics_reused_from_phase79d_only, true);
assert.equal(contract.historical_method_semantics_copied, false);
assert.equal(contract.preference_resolution_performed, false);
assert.equal(contract.action_selection_performed, false);
assert.equal(contract.world_truth_authority_claimed, false);

const fixture = makeFixture();
const projection = projectWorldSimulationAnalogicalExperienceRevalidation({
  source_phase79d_impasse_deliberation: fixture.phase79D,
  source_phase79e_discriminating_evidence: fixture.phase79E,
  source_phase80a_projection: fixture.phase80A,
  source_phase80b_adaptation: fixture.phase80B,
});
assert.equal(projection.revalidated_method_count, 1);
assert.equal(projection.character_view.adapted_methods.length, 1);
assert.equal(projection.character_view.current_context_revalidated, true);
assert.equal(projection.character_view.advisory_only, true);
assert.equal(projection.character_view.candidate_action_generation_owner, "existing_world_action_proposer");
assert.equal(projection.character_view.preference_authority, false);
assert.equal(projection.character_view.selected_action_authority, false);
const adapted = projection.character_view.adapted_methods[0];
assert.equal(adapted.current_corresponding_method_ref, transferRef);
assert.deepEqual(adapted.method_skeleton, methodSkeleton);
assert.deepEqual(
  adapted.current_context_basis.map((cue) => cue.adaptation_role),
  ["retained_alignment", "incorporated_difference"],
);
assert.deepEqual(adapted.current_context_basis[0].content, { route: "narrow corridor" });
assert.deepEqual(adapted.current_context_basis[1].content, { nearby_threat: "closing distance" });
assert.equal(JSON.stringify(projection.character_view).includes("historical_visibility"), false);
assert.equal(projection.audit.additional_resolver_used, false);
assert.equal(projection.audit.preference_resolution_performed, false);
assert.equal(projection.audit.action_selection_performed, false);
assert.equal(projection.audit.world_truth_authority_claimed, false);

const changedCurrentMethod = structuredClone(fixture.phase79D);
changedCurrentMethod.impasse_contexts[0].candidate_methods[0].method_skeleton = {
  trigger_relation: "different_current_method",
};
delete changedCurrentMethod.impasse_hash;
changedCurrentMethod.impasse_hash = hashAgentRunValue(changedCurrentMethod);
const matchingChangedEvidence = structuredClone(fixture.phase79E);
matchingChangedEvidence.source_phase79d_impasse_hash = changedCurrentMethod.impasse_hash;
delete matchingChangedEvidence.evidence_hash;
matchingChangedEvidence.evidence_hash = hashAgentRunValue(matchingChangedEvidence);
const changedPhase80A = structuredClone(fixture.phase80A);
changedPhase80A.source_phase79e_evidence_hash = matchingChangedEvidence.evidence_hash;
delete changedPhase80A.projection_hash;
changedPhase80A.projection_hash = hashAgentRunValue(changedPhase80A);
const changedView = buildWorldSimulationAnalogicalExperienceAdaptationResolverView({
  source_phase80a_projection: changedPhase80A,
});
const changedPhase80B = projectWorldSimulationAnalogicalExperienceAdaptation({
  resolver_view: changedView,
  adaptation_decisions: fixture.phase80B.adaptation_decisions.map((decision) => ({
    analogy_candidate_ref: decision.analogy_candidate_ref,
    retain_aligned_current_cue_refs: decision.retain_aligned_current_cue_refs,
    drop_historical_cue_refs: decision.drop_historical_cue_refs,
    incorporate_current_cue_refs: decision.incorporate_current_cue_refs,
  })),
});
assert.throws(
  () => projectWorldSimulationAnalogicalExperienceRevalidation({
    source_phase79d_impasse_deliberation: changedCurrentMethod,
    source_phase79e_discriminating_evidence: matchingChangedEvidence,
    source_phase80a_projection: changedPhase80A,
    source_phase80b_adaptation: changedPhase80B,
  }),
  (error) => error?.code === "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_REVALIDATION_CURRENT_METHOD_MISMATCH",
);

const missingCueEvidence = structuredClone(fixture.phase79E);
missingCueEvidence.impasse_evidence_contexts[0].current_context_cue_catalog =
  missingCueEvidence.impasse_evidence_contexts[0].current_context_cue_catalog
    .filter((cue) => cue.cue_ref !== "current_threat");
delete missingCueEvidence.evidence_hash;
missingCueEvidence.evidence_hash = hashAgentRunValue(missingCueEvidence);
const missingCuePhase80A = structuredClone(fixture.phase80A);
missingCuePhase80A.source_phase79e_evidence_hash = missingCueEvidence.evidence_hash;
delete missingCuePhase80A.projection_hash;
missingCuePhase80A.projection_hash = hashAgentRunValue(missingCuePhase80A);
const missingCueView = buildWorldSimulationAnalogicalExperienceAdaptationResolverView({
  source_phase80a_projection: missingCuePhase80A,
});
const missingCuePhase80B = projectWorldSimulationAnalogicalExperienceAdaptation({
  resolver_view: missingCueView,
  adaptation_decisions: [{
    analogy_candidate_ref: missingCueView.analogy_candidates[0].analogy_candidate_ref,
    retain_aligned_current_cue_refs: ["current_route"],
    drop_historical_cue_refs: ["historical_visibility"],
    incorporate_current_cue_refs: ["current_threat"],
  }],
});
assert.throws(
  () => projectWorldSimulationAnalogicalExperienceRevalidation({
    source_phase79d_impasse_deliberation: fixture.phase79D,
    source_phase79e_discriminating_evidence: missingCueEvidence,
    source_phase80a_projection: missingCuePhase80A,
    source_phase80b_adaptation: missingCuePhase80B,
  }),
  (error) => error?.code === "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_REVALIDATION_CURRENT_CUE_MISMATCH",
);

console.log("Phase80C adapted analogy current-context revalidation tests passed.");
