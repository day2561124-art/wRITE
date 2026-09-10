import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import {
  worldSimulationExperientialMethodApplicationLineageVersion,
} from "../../server/src/world-simulation-experiential-method-application-lineage-service.mjs";
import {
  worldSimulationExperientialMethodImpasseReresolutionVersion,
} from "../../server/src/world-simulation-experiential-method-impasse-reresolution-service.mjs";
import {
  worldSimulationExperientialMethodImpassePrecedentReresolutionVersion,
} from "../../server/src/world-simulation-experiential-method-impasse-precedent-reresolution-service.mjs";
import {
  assertWorldSimulationExperientialMethodImpasseResolutionApplicationLineageBundle,
  buildWorldSimulationExperientialMethodImpasseResolutionApplicationLineage,
  buildWorldSimulationExperientialMethodImpasseResolutionApplicationLineageContract,
} from "../../server/src/world-simulation-experiential-method-impasse-resolution-application-lineage-service.mjs";
import {
  worldSimulationExperientialMethodOutcomeCreditVersion,
} from "../../server/src/world-simulation-experiential-method-outcome-credit-service.mjs";
import {
  assertWorldSimulationExperientialMethodImpasseResolutionOutcomeEvidence,
  buildWorldSimulationExperientialMethodImpasseResolutionOutcomeEvidence,
  buildWorldSimulationExperientialMethodImpasseResolutionOutcomeEvidenceContract,
} from "../../server/src/world-simulation-experiential-method-impasse-resolution-outcome-evidence-service.mjs";

const sessionId = "world_session_phase79k";
const turnId = "turn_phase79k";
const stateRevision = 23;
const worldStateHash = "world_state_hash_phase79k";
const character = "伊萊亞斯・諾爾";
const dominantMethodRef = "phase76e_transfer_method_phase79k_a";
const otherMethodRef = "phase76e_transfer_method_phase79k_b";
const impasseRef = "phase79d_impasse_phase79k_1";

function applicationReceiptBundle({ appliedMethodRefs = [dominantMethodRef] } = {}) {
  const methodRefs = [...new Set(appliedMethodRefs)].sort();
  const identity = {
    version: worldSimulationExperientialMethodApplicationLineageVersion,
    world_simulation_session_id: sessionId,
    turn_id: turnId,
    state_revision: stateRevision,
    world_state_hash: worldStateHash,
    character,
    selection_kind: "candidate_action_intent",
    action_id: "action_phase79k_1",
    action_ref: "phase74a_action_phase79k_1",
    phase74d_choice_receipt_id: "phase74d_choice_phase79k_1",
    phase74d_choice_receipt_hash: "phase74d_choice_hash_phase79k_1",
    source_phase76f_projection_hash: "phase76f_projection_hash_phase79k_1",
    source_phase76e_transfer_hash: "phase76e_transfer_hash_phase79k_1",
    candidate_attribution_refs: ["phase76f_candidate_phase79k_1"],
    applied_method_refs: methodRefs,
  };
  const receiptHash = hashAgentRunValue(identity);
  const receipt = {
    receipt_id: `phase76f_application_${receiptHash.slice(0, 24)}`,
    receipt_hash: receiptHash,
    ...identity,
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
  const bundle = {
    version: worldSimulationExperientialMethodApplicationLineageVersion,
    world_simulation_session_id: sessionId,
    turn_id: turnId,
    state_revision: stateRevision,
    world_state_hash: worldStateHash,
    source_phase74d_receipt_bundle_hash: "phase74d_bundle_hash_phase79k",
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
  };
  bundle.receipt_bundle_hash = hashAgentRunValue(bundle);
  return bundle;
}

function phase79FProjection({ resolved = false, projectionCharacter = character } = {}) {
  const revision = {
    impasse_ref: impasseRef,
    competition_ref: "phase79a_competition_phase79k_1",
    preference: "left_preferred",
    evidence_cue_refs: ["phase79e_cue_phase79k_1"],
  };
  const result = resolved
    ? {
      impasse_ref: impasseRef,
      prior_impasse_type: "tie_impasse",
      revised_resolution_ref: "phase79b_resolution_phase79k_f_resolved",
      resolution_status: "resolved_dominant",
      dominant_method_ref: dominantMethodRef,
      retained_method_refs: [dominantMethodRef],
      applied_preference_revisions: [revision],
      resolved: true,
    }
    : {
      impasse_ref: impasseRef,
      prior_impasse_type: "tie_impasse",
      revised_resolution_ref: "phase79b_resolution_phase79k_f_unresolved",
      resolution_status: "tie_impasse",
      dominant_method_ref: null,
      retained_method_refs: [dominantMethodRef, otherMethodRef],
      applied_preference_revisions: [],
      resolved: false,
    };
  const effectiveResolutionHash = resolved
    ? "phase79b_effective_resolution_hash_phase79k_f_resolved"
    : "phase79b_effective_resolution_hash_phase79k_f_unresolved";
  const projection = {
    version: worldSimulationExperientialMethodImpasseReresolutionVersion,
    character: projectionCharacter,
    current_turn_id: turnId,
    source_phase79b_resolution_hash: "phase79b_source_resolution_hash_phase79k",
    source_phase79d_impasse_hash: "phase79d_impasse_hash_phase79k",
    source_phase79e_evidence_hash: "phase79e_evidence_hash_phase79k",
    resolver_view_hash: "phase79f_resolver_view_hash_phase79k",
    preference_revision_records: resolved ? [revision] : [],
    effective_competition_resolution: {
      version: "phase79b-experiential-method-competition-resolution-v1",
      resolution_hash: effectiveResolutionHash,
    },
    effective_phase79b_resolution_hash: effectiveResolutionHash,
    impasse_results: [result],
    resolved_impasse_refs: resolved ? [impasseRef] : [],
    remaining_impasse_refs: resolved ? [] : [impasseRef],
    resolved_impasse_count: resolved ? 1 : 0,
    remaining_impasse_count: resolved ? 0 : 1,
    character_view: {
      source: "phase79f_evidence_grounded_experiential_method_impasse_reresolution",
      impasse_results: [result],
      deliberation_required: !resolved,
      advisory_only: true,
      selected_action_authority: false,
      semantic_revision_authority: false,
      world_truth_authority: false,
    },
    audit: {
      exact_phase79b_phase79d_phase79e_lineage_verified: true,
      bounded_phase79d_phase79e_resolver_surface_only: true,
      existing_phase79b_competition_refs_only: true,
      existing_phase79b_resolution_kernel_reused: true,
      evidence_cue_refs_required_for_every_revision: true,
      omitted_competition_ref_preserved_prior_preference: true,
      arbitrary_tie_breaking_used: false,
      numeric_similarity_confidence_probability_utility_modeled: false,
      action_selection_performed: false,
      direct_plan_goal_belief_current_mind_world_mutation_performed: false,
      semantic_revision_performed: false,
      same_turn_learning_feedback_performed: false,
      world_truth_authority_claimed: false,
    },
  };
  projection.reresolution_hash = hashAgentRunValue(projection);
  return projection;
}

function phase79JProjection(sourcePhase79F = phase79FProjection()) {
  const precedentRevision = {
    impasse_ref: impasseRef,
    competition_ref: "phase79a_competition_phase79k_1",
    preference: "left_preferred",
    precedent_refs: ["phase79i_precedent_phase79k_1"],
  };
  const result = {
    impasse_ref: impasseRef,
    prior_impasse_type: "tie_impasse",
    revised_resolution_ref: "phase79b_resolution_phase79k_j_resolved",
    resolution_status: "resolved_dominant",
    dominant_method_ref: dominantMethodRef,
    retained_method_refs: [dominantMethodRef],
    applied_precedent_revisions: [precedentRevision],
    resolved: true,
  };
  const effectiveResolutionHash = "phase79b_effective_resolution_hash_phase79k_j_resolved";
  const projection = {
    version: worldSimulationExperientialMethodImpassePrecedentReresolutionVersion,
    character,
    current_turn_id: turnId,
    source_phase79b_resolver_view_hash: "phase79b_resolver_view_hash_phase79k",
    source_phase79f_reresolution_hash: sourcePhase79F.reresolution_hash,
    source_phase79i_precedent_reentry_hash: "phase79i_precedent_reentry_hash_phase79k",
    resolver_view_hash: "phase79j_resolver_view_hash_phase79k",
    preference_revision_records: [precedentRevision],
    effective_competition_resolution: {
      version: "phase79b-experiential-method-competition-resolution-v1",
      resolution_hash: effectiveResolutionHash,
    },
    effective_phase79b_resolution_hash: effectiveResolutionHash,
    impasse_results: [result],
    resolved_impasse_refs: [impasseRef],
    remaining_impasse_refs: [],
    resolved_impasse_count: 1,
    remaining_impasse_count: 0,
    character_view: {
      source: "phase79j_precedent_grounded_experiential_method_impasse_reresolution",
      impasse_results: [result],
      deliberation_required: false,
      precedent_refs_exposed: false,
      historical_outcome_details_exposed: false,
      advisory_only: true,
      selected_action_authority: false,
      semantic_revision_authority: false,
      world_truth_authority: false,
    },
    audit: {
      exact_phase79b_phase79f_phase79i_lineage_verified: true,
      phase79f_remaining_impasses_only: true,
      exact_full_cue_match_precedents_only: true,
      cited_precedent_pair_relevance_verified: true,
      directional_evidence_relevance_verified: true,
      existing_phase79b_resolution_kernel_reused: true,
      automatic_precedent_voting_used: false,
      precedent_recency_weighting_used: false,
      fuzzy_similarity_used: false,
      numeric_success_rate_confidence_probability_utility_reward_modeled: false,
      historical_outcome_treated_as_comparative_truth: false,
      action_selection_performed: false,
      direct_plan_goal_belief_current_mind_world_mutation_performed: false,
      semantic_revision_performed: false,
      world_truth_authority_claimed: false,
    },
  };
  projection.reresolution_hash = hashAgentRunValue(projection);
  return projection;
}

function phase79GFromJ({ appliedMethodRefs = [dominantMethodRef], sourcePhase79F = phase79FProjection(), phase79J = null } = {}) {
  const j = phase79J ?? phase79JProjection(sourcePhase79F);
  return buildWorldSimulationExperientialMethodImpasseResolutionApplicationLineage({
    world_simulation_session_id: sessionId,
    turn_id: turnId,
    state_revision: stateRevision,
    world_state_hash: worldStateHash,
    impasse_reresolution_projections: [sourcePhase79F],
    impasse_precedent_reresolution_projections: [j],
    selected_application_receipts: applicationReceiptBundle({ appliedMethodRefs }),
  });
}

function phase76GProjection(applicationBundle = applicationReceiptBundle()) {
  const applicationReceipt = applicationBundle.receipts[0];
  const identity = {
    version: worldSimulationExperientialMethodOutcomeCreditVersion,
    turn_id: turnId,
    application_ref: "phase76g_application_phase79k_1",
    phase76f_application_receipt_id: applicationReceipt.receipt_id,
    phase76f_application_receipt_hash: applicationReceipt.receipt_hash,
    assessment: "supports_prior_method",
  };
  const assessmentHash = hashAgentRunValue(identity);
  const assessment = {
    assessment_ref: `phase76g_credit_${assessmentHash.slice(0, 24)}`,
    assessment_hash: assessmentHash,
    ...identity,
    character,
    action_id: applicationReceipt.action_id,
    outcome_basis: "bounded_subjective_post_outcome_experience",
    objective_causation_claimed: false,
    numeric_credit_assigned: false,
    semantic_revision_emitted: true,
    semantic_revision_deferred: false,
    subjective_not_world_truth: true,
  };
  const projection = {
    version: worldSimulationExperientialMethodOutcomeCreditVersion,
    turn_id: turnId,
    source_phase76f_receipt_bundle_hash: applicationBundle.receipt_bundle_hash,
    source_phase76b_bridge_hash: "phase76b_bridge_hash_phase79k",
    resolver_view_hash: "phase76g_resolver_view_hash_phase79k",
    assessment_count: 1,
    assessments: [assessment],
    semantic_decision_count: 0,
    semantic_decisions: [],
    audit: {
      exact_phase76f_application_receipts_verified: true,
      exact_phase76b_subjective_experience_verified: true,
      exact_phase76d_phase76e_method_lineage_verified: true,
      multi_method_automatic_credit_allowed: false,
      performed_required_for_semantic_revision: true,
      current_phase67b_life_event_required_for_semantic_revision: true,
      raw_action_outcome_consumed: false,
      hidden_causal_evidence_consumed: false,
      objective_causation_claimed: false,
      success_auto_credits_method: false,
      failure_auto_discredits_method: false,
      numeric_reward_q_value_success_rate_modeled: false,
      phase67c_support_counterevidence_reused: true,
      parallel_semantic_store_created: false,
      direct_belief_plan_goal_current_mind_world_mutation: false,
      same_turn_character_brain_feedback: false,
    },
  };
  projection.projection_hash = hashAgentRunValue(projection);
  return projection;
}

const contract = buildWorldSimulationExperientialMethodImpasseResolutionApplicationLineageContract();
assert.deepEqual(contract.source_resolution_owners, ["Phase79F", "Phase79J"]);
assert.equal(contract.phase79j_requires_exact_phase79f_ancestor, true);
assert.equal(contract.resolution_caused_action_choice_claimed, false);
assert.equal(contract.action_outcome_consumed, false);
assert.equal(contract.semantic_retention_performed, false);
assert.equal(contract.numeric_confidence_probability_utility_reward_modeled, false);
assert.equal(contract.world_truth_authority_claimed, false);

// Legacy Phase79F-only lineage retains its original canonical shape and hash identity.
const legacyPhase79F = phase79FProjection({ resolved: true });
const legacyApplicationBundle = applicationReceiptBundle();
const legacy = buildWorldSimulationExperientialMethodImpasseResolutionApplicationLineage({
  world_simulation_session_id: sessionId,
  turn_id: turnId,
  state_revision: stateRevision,
  world_state_hash: worldStateHash,
  impasse_reresolution_projections: [legacyPhase79F],
  selected_application_receipts: legacyApplicationBundle,
});
assert.equal(legacy.receipt_count, 1);
assert.equal(Object.hasOwn(legacy, "source_phase79j_reresolution_hashes"), false);
assert.equal(Object.hasOwn(legacy.receipts[0], "resolution_source_owner"), false);
assert.equal(Object.hasOwn(legacy.receipts[0], "phase79j_reresolution_hash"), false);
const legacyIdentity = {
  version: legacy.receipts[0].version,
  world_simulation_session_id: sessionId,
  turn_id: turnId,
  state_revision: stateRevision,
  world_state_hash: worldStateHash,
  character,
  phase79f_reresolution_hash: legacyPhase79F.reresolution_hash,
  impasse_ref: impasseRef,
  prior_impasse_type: "tie_impasse",
  resolution_status: "resolved_dominant",
  dominant_method_ref: dominantMethodRef,
  phase76f_application_receipt_id: legacyApplicationBundle.receipts[0].receipt_id,
  phase76f_application_receipt_hash: legacyApplicationBundle.receipts[0].receipt_hash,
  action_id: legacyApplicationBundle.receipts[0].action_id,
  action_ref: legacyApplicationBundle.receipts[0].action_ref,
  applied_method_refs: [dominantMethodRef],
};
assert.equal(legacy.receipts[0].receipt_hash, hashAgentRunValue(legacyIdentity));

// A canonical Phase79J result can close the existing Phase79G edge only when its
// dominant method really participated in the selected Phase76F application.
const sourcePhase79F = phase79FProjection();
const phase79J = phase79JProjection(sourcePhase79F);
const linked = phase79GFromJ({ sourcePhase79F, phase79J });
assert.equal(linked.receipt_count, 1);
assert.deepEqual(linked.source_phase79f_reresolution_hashes, [sourcePhase79F.reresolution_hash]);
assert.deepEqual(linked.source_phase79j_reresolution_hashes, [phase79J.reresolution_hash]);
assert.equal(linked.receipts[0].resolution_source_owner, "Phase79J");
assert.equal(linked.receipts[0].phase79f_reresolution_hash, sourcePhase79F.reresolution_hash);
assert.equal(linked.receipts[0].phase79j_reresolution_hash, phase79J.reresolution_hash);
assert.equal(linked.receipts[0].dominant_method_ref, dominantMethodRef);
assert.equal(linked.receipts[0].resolution_dominant_method_participated_in_selected_candidate, true);
assert.equal(linked.receipts[0].resolution_caused_action_choice_claimed, false);
assert.equal(linked.receipts[0].action_outcome_observed, false);
assert.equal(linked.receipts[0].semantic_retention_performed, false);
assert.equal(linked.receipts[0].world_truth_authority, false);
assert.doesNotThrow(() => assertWorldSimulationExperientialMethodImpasseResolutionApplicationLineageBundle(
  linked,
  {
    world_simulation_session_id: sessionId,
    turn_id: turnId,
    state_revision: stateRevision,
    world_state_hash: worldStateHash,
  },
));

const notSelected = phase79GFromJ({
  sourcePhase79F,
  phase79J,
  appliedMethodRefs: [otherMethodRef],
});
assert.equal(notSelected.receipt_count, 0);

const tamperedJ = JSON.parse(JSON.stringify(phase79J));
tamperedJ.impasse_results[0].dominant_method_ref = otherMethodRef;
assert.throws(
  () => phase79GFromJ({ sourcePhase79F, phase79J: tamperedJ }),
  (error) => error?.code
    === "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RESOLUTION_APPLICATION_LINEAGE_PHASE79J_HASH_MISMATCH",
);

const wrongAncestor = phase79JProjection(sourcePhase79F);
wrongAncestor.source_phase79f_reresolution_hash = "forged_phase79f_hash";
delete wrongAncestor.reresolution_hash;
wrongAncestor.reresolution_hash = hashAgentRunValue(wrongAncestor);
assert.throws(
  () => phase79GFromJ({ sourcePhase79F, phase79J: wrongAncestor }),
  (error) => error?.code
    === "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RESOLUTION_APPLICATION_LINEAGE_PHASE79J_SOURCE_MISMATCH",
);

const outcomeContract = buildWorldSimulationExperientialMethodImpasseResolutionOutcomeEvidenceContract();
assert.equal(outcomeContract.phase79g_resolution_source_provenance_preserved, true);
assert.equal(outcomeContract.phase79j_resolution_hash_preserved_when_present, true);
const applicationBundle = applicationReceiptBundle();
const linkedForOutcome = buildWorldSimulationExperientialMethodImpasseResolutionApplicationLineage({
  world_simulation_session_id: sessionId,
  turn_id: turnId,
  state_revision: stateRevision,
  world_state_hash: worldStateHash,
  impasse_reresolution_projections: [sourcePhase79F],
  impasse_precedent_reresolution_projections: [phase79J],
  selected_application_receipts: applicationBundle,
});
const outcomeEvidence = buildWorldSimulationExperientialMethodImpasseResolutionOutcomeEvidence({
  world_simulation_session_id: sessionId,
  turn_id: turnId,
  state_revision: stateRevision,
  world_state_hash: worldStateHash,
  impasse_resolution_application_lineage: linkedForOutcome,
  experiential_method_outcome_credit: phase76GProjection(applicationBundle),
});
assert.equal(outcomeEvidence.evidence_count, 1);
assert.equal(outcomeEvidence.evidence_records[0].resolution_source_owner, "Phase79J");
assert.equal(outcomeEvidence.evidence_records[0].phase79f_reresolution_hash, sourcePhase79F.reresolution_hash);
assert.equal(outcomeEvidence.evidence_records[0].phase79j_reresolution_hash, phase79J.reresolution_hash);
assert.equal(outcomeEvidence.evidence_records[0].dominant_method_ref, dominantMethodRef);
assert.equal(outcomeEvidence.evidence_records[0].comparative_preference_validated, false);
assert.equal(outcomeEvidence.evidence_records[0].counterfactual_superiority_inferred, false);
assert.equal(outcomeEvidence.evidence_records[0].semantic_retention_performed, false);
assert.equal(outcomeEvidence.evidence_records[0].world_truth_authority, false);
assert.doesNotThrow(() => assertWorldSimulationExperientialMethodImpasseResolutionOutcomeEvidence(
  outcomeEvidence,
  {
    world_simulation_session_id: sessionId,
    turn_id: turnId,
    state_revision: stateRevision,
    world_state_hash: worldStateHash,
  },
));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const loopSource = fs.readFileSync(
  path.resolve(__dirname, "../../server/src/world-simulation-loop-service.mjs"),
  "utf8",
);
const reentrySource = fs.readFileSync(
  path.resolve(__dirname, "../../server/src/world-simulation-experiential-method-impasse-precedent-reentry-service.mjs"),
  "utf8",
);
const phase79gIndex = loopSource.indexOf(
  "const experientialMethodImpasseResolutionApplicationLineage =",
);
const causalAdjudicationIndex = loopSource.indexOf(
  "const causalResolution = assertCausalResolution",
  phase79gIndex,
);
assert.ok(phase79gIndex >= 0 && causalAdjudicationIndex > phase79gIndex);
assert.match(
  loopSource,
  /impasse_precedent_reresolution_projections:\s*preparedTurn\.experiential_method_impasse_precedent_reresolution_projections \?\? \[\]/,
);
assert.match(
  loopSource,
  /experiential_method_impasse_resolution_application_lineage:\s*cloneJson\(experientialMethodImpasseResolutionApplicationLineage\)/,
);
const phase79JHistoryClosureIndex = reentrySource.indexOf(
  'if (outcomeEvidence.resolution_source_owner === "Phase79J") {',
);
const historicalPhase79JLookupIndex = reentrySource.indexOf(
  "const phase79JRaw = array(turn.experiential_method_impasse_precedent_reresolution_projections)",
  phase79JHistoryClosureIndex,
);
assert.ok(
  phase79JHistoryClosureIndex >= 0
    && historicalPhase79JLookupIndex > phase79JHistoryClosureIndex,
);
assert.doesNotMatch(
  reentrySource,
  /if \(outcomeEvidence\.resolution_source_owner === "Phase79J"\) continue;/,
);

console.log("Phase79K Phase79J resolution application lineage closure tests passed.");
