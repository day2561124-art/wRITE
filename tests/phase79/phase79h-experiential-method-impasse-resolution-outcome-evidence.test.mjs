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
  buildWorldSimulationExperientialMethodImpasseResolutionApplicationLineage,
} from "../../server/src/world-simulation-experiential-method-impasse-resolution-application-lineage-service.mjs";
import {
  worldSimulationExperientialMethodOutcomeCreditVersion,
} from "../../server/src/world-simulation-experiential-method-outcome-credit-service.mjs";
import {
  assertWorldSimulationExperientialMethodImpasseResolutionOutcomeEvidence,
  buildWorldSimulationExperientialMethodImpasseResolutionOutcomeEvidence,
  buildWorldSimulationExperientialMethodImpasseResolutionOutcomeEvidenceContract,
  worldSimulationExperientialMethodImpasseResolutionOutcomeEvidenceVersion,
} from "../../server/src/world-simulation-experiential-method-impasse-resolution-outcome-evidence-service.mjs";

const sessionId = "world_session_phase79h";
const turnId = "turn_phase79h";
const stateRevision = 19;
const worldStateHash = "world_state_hash_phase79h";
const character = "伊萊亞斯・諾爾";
const dominantMethodRef = "phase76e_transfer_method_phase79h_a";
const otherMethodRef = "phase76e_transfer_method_phase79h_b";

function phase76FApplicationBundle() {
  const identity = {
    version: worldSimulationExperientialMethodApplicationLineageVersion,
    world_simulation_session_id: sessionId,
    turn_id: turnId,
    state_revision: stateRevision,
    world_state_hash: worldStateHash,
    character,
    selection_kind: "candidate_action_intent",
    action_id: "action_phase79h_1",
    action_ref: "phase74a_action_phase79h_1",
    phase74d_choice_receipt_id: "phase74d_choice_phase79h_1",
    phase74d_choice_receipt_hash: "phase74d_choice_hash_phase79h_1",
    source_phase76f_projection_hash: "phase76f_projection_hash_phase79h_1",
    source_phase76e_transfer_hash: "phase76e_transfer_hash_phase79h_1",
    candidate_attribution_refs: ["phase76f_candidate_phase79h_1"],
    applied_method_refs: [dominantMethodRef],
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
    source_phase74d_receipt_bundle_hash: "phase74d_bundle_hash_phase79h",
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

function phase79FReresolutionProjection() {
  const impasseRef = "phase79d_impasse_phase79h_1";
  const revision = {
    impasse_ref: impasseRef,
    competition_ref: "phase79a_competition_phase79h_1",
    preference: "left_preferred",
    evidence_cue_refs: ["phase79e_cue_phase79h_1"],
  };
  const result = {
    impasse_ref: impasseRef,
    prior_impasse_type: "tie_impasse",
    revised_resolution_ref: "phase79b_resolution_phase79h_revised",
    resolution_status: "resolved_dominant",
    dominant_method_ref: dominantMethodRef,
    retained_method_refs: [dominantMethodRef],
    applied_preference_revisions: [revision],
    resolved: true,
  };
  const effectiveResolutionHash = "phase79b_effective_resolution_hash_phase79h";
  const projection = {
    version: worldSimulationExperientialMethodImpasseReresolutionVersion,
    character,
    current_turn_id: turnId,
    source_phase79b_resolution_hash: "phase79b_source_resolution_hash_phase79h",
    source_phase79d_impasse_hash: "phase79d_impasse_hash_phase79h",
    source_phase79e_evidence_hash: "phase79e_evidence_hash_phase79h",
    resolver_view_hash: "phase79f_resolver_view_hash_phase79h",
    preference_revision_records: [revision],
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
      source: "phase79f_evidence_grounded_experiential_method_impasse_reresolution",
      impasse_results: [result],
      deliberation_required: false,
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

function phase79GLineageBundle() {
  return buildWorldSimulationExperientialMethodImpasseResolutionApplicationLineage({
    world_simulation_session_id: sessionId,
    turn_id: turnId,
    state_revision: stateRevision,
    world_state_hash: worldStateHash,
    impasse_reresolution_projections: [phase79FReresolutionProjection()],
    selected_application_receipts: phase76FApplicationBundle(),
  });
}

function phase76GProjection({ assessment = "supports_prior_method", includeAssessment = true, receiptHashOverride = null } = {}) {
  const applicationBundle = phase76FApplicationBundle();
  const applicationReceipt = applicationBundle.receipts[0];
  const assessments = [];
  if (includeAssessment) {
    const identity = {
      version: worldSimulationExperientialMethodOutcomeCreditVersion,
      turn_id: turnId,
      application_ref: "phase76g_application_phase79h_1",
      phase76f_application_receipt_id: applicationReceipt.receipt_id,
      phase76f_application_receipt_hash: receiptHashOverride ?? applicationReceipt.receipt_hash,
      assessment,
    };
    const assessmentHash = hashAgentRunValue(identity);
    assessments.push({
      assessment_ref: `phase76g_credit_${assessmentHash.slice(0, 24)}`,
      assessment_hash: assessmentHash,
      ...identity,
      character,
      action_id: applicationReceipt.action_id,
      outcome_basis: "bounded_subjective_post_outcome_experience",
      objective_causation_claimed: false,
      numeric_credit_assigned: false,
      semantic_revision_emitted: assessment !== "ambiguous_no_revision",
      semantic_revision_deferred: false,
      subjective_not_world_truth: true,
    });
  }
  const projection = {
    version: worldSimulationExperientialMethodOutcomeCreditVersion,
    turn_id: turnId,
    source_phase76f_receipt_bundle_hash: applicationBundle.receipt_bundle_hash,
    source_phase76b_bridge_hash: "phase76b_bridge_hash_phase79h",
    resolver_view_hash: "phase76g_resolver_view_hash_phase79h",
    assessment_count: assessments.length,
    assessments,
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

function build(input = {}) {
  return buildWorldSimulationExperientialMethodImpasseResolutionOutcomeEvidence({
    world_simulation_session_id: sessionId,
    turn_id: turnId,
    state_revision: stateRevision,
    world_state_hash: worldStateHash,
    impasse_resolution_application_lineage: phase79GLineageBundle(),
    experiential_method_outcome_credit: phase76GProjection(),
    ...input,
  });
}

const contract = buildWorldSimulationExperientialMethodImpasseResolutionOutcomeEvidenceContract();
assert.equal(contract.version, worldSimulationExperientialMethodImpasseResolutionOutcomeEvidenceVersion);
assert.equal(contract.phase, "Phase79H");
assert.equal(contract.comparative_preference_validated, false);
assert.equal(contract.alternative_method_outcomes_observed, false);
assert.equal(contract.counterfactual_superiority_inferred, false);
assert.equal(contract.automatic_preference_retention_performed, false);
assert.equal(contract.semantic_retention_performed, false);
assert.equal(contract.raw_action_outcome_consumed, false);
assert.equal(contract.hidden_causal_evidence_consumed, false);
assert.equal(contract.resolver_used, false);

const supported = build();
assert.equal(supported.evidence_count, 1);
assert.equal(supported.evidence_records[0].dominant_method_ref, dominantMethodRef);
assert.equal(supported.evidence_records[0].method_outcome_assessment, "supports_prior_method");
assert.equal(
  supported.evidence_records[0].outcome_evidence_kind,
  "resolution_selected_method_supported_by_subjective_outcome",
);
assert.equal(supported.evidence_records[0].comparative_preference_validated, false);
assert.equal(supported.evidence_records[0].alternative_method_outcomes_observed, false);
assert.equal(supported.evidence_records[0].counterfactual_superiority_inferred, false);
assert.equal(supported.evidence_records[0].resolution_success_inferred, false);
assert.equal(supported.evidence_records[0].preference_retention_performed, false);
assert.equal(supported.audit.same_turn_character_brain_feedback, false);
assert.doesNotThrow(() => assertWorldSimulationExperientialMethodImpasseResolutionOutcomeEvidence(
  supported,
  {
    world_simulation_session_id: sessionId,
    turn_id: turnId,
    state_revision: stateRevision,
    world_state_hash: worldStateHash,
  },
));

const counterevidence = build({
  experiential_method_outcome_credit: phase76GProjection({ assessment: "counterevidence_for_prior_method" }),
});
assert.equal(counterevidence.evidence_count, 1);
assert.equal(counterevidence.evidence_records[0].method_outcome_assessment, "counterevidence_for_prior_method");
assert.equal(
  counterevidence.evidence_records[0].outcome_evidence_kind,
  "resolution_selected_method_counterevidenced_by_subjective_outcome",
);
assert.equal(counterevidence.evidence_records[0].resolution_failure_inferred, false);
assert.equal(counterevidence.evidence_records[0].comparative_preference_validated, false);

const ambiguous = build({
  experiential_method_outcome_credit: phase76GProjection({ assessment: "ambiguous_no_revision" }),
});
assert.equal(ambiguous.evidence_count, 1);
assert.equal(ambiguous.evidence_records[0].outcome_evidence_kind, "resolution_selected_method_outcome_ambiguous");
assert.equal(ambiguous.evidence_records[0].preference_retention_performed, false);

const noExplicitAssessment = build({
  experiential_method_outcome_credit: phase76GProjection({ includeAssessment: false }),
});
assert.equal(noExplicitAssessment.evidence_count, 0);

const mismatchedReceipt = phase76GProjection({ receiptHashOverride: "forged_phase76f_receipt_hash" });
assert.throws(
  () => build({ experiential_method_outcome_credit: mismatchedReceipt }),
  (error) => error?.code
    === "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RESOLUTION_OUTCOME_EVIDENCE_SOURCE_MISMATCH",
);

const tamperedPhase76G = phase76GProjection();
tamperedPhase76G.assessments[0].assessment = "counterevidence_for_prior_method";
assert.throws(
  () => build({ experiential_method_outcome_credit: tamperedPhase76G }),
  (error) => error?.code
    === "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RESOLUTION_OUTCOME_EVIDENCE_PHASE76G_HASH_MISMATCH",
);

const tamperedPhase79G = JSON.parse(JSON.stringify(phase79GLineageBundle()));
tamperedPhase79G.receipts[0].dominant_method_ref = otherMethodRef;
assert.throws(
  () => build({ impasse_resolution_application_lineage: tamperedPhase79G }),
  (error) => error?.code
    === "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RESOLUTION_APPLICATION_LINEAGE_BUNDLE_HASH_MISMATCH",
);

const duplicatePhase76G = phase76GProjection();
const duplicateAssessment = { ...duplicatePhase76G.assessments[0] };
duplicatePhase76G.assessments.push(duplicateAssessment);
duplicatePhase76G.assessment_count = 2;
delete duplicatePhase76G.projection_hash;
duplicatePhase76G.projection_hash = hashAgentRunValue(duplicatePhase76G);
assert.throws(
  () => build({ experiential_method_outcome_credit: duplicatePhase76G }),
  (error) => error?.code
    === "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RESOLUTION_OUTCOME_EVIDENCE_PHASE76G_ASSESSMENT_DUPLICATE",
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
const phase79gIndex = loopSource.indexOf(
  "const experientialMethodImpasseResolutionApplicationLineage =",
);
const phase76gIndex = loopSource.indexOf(
  "const experientialMethodOutcomeCredit =",
  phase79gIndex,
);
const phase79hIndex = loopSource.indexOf(
  "const experientialMethodImpasseResolutionOutcomeEvidence =",
  phase76gIndex,
);
const phase67cRevisionIndex = loopSource.indexOf(
  "const experientialMethodSemanticRevision =",
  phase79hIndex,
);
assert.ok(
  phase79gIndex >= 0
    && phase76gIndex > phase79gIndex
    && phase79hIndex > phase76gIndex
    && phase67cRevisionIndex > phase79hIndex,
);
assert.match(
  loopSource,
  /impasse_resolution_application_lineage:\s*experientialMethodImpasseResolutionApplicationLineage/,
);
assert.match(
  loopSource,
  /experiential_method_outcome_credit:\s*experientialMethodOutcomeCredit/,
);
assert.match(
  loopSource,
  /experiential_method_impasse_resolution_outcome_evidence:\s*cloneJson\(experientialMethodImpasseResolutionOutcomeEvidence\)/,
);
assert.match(
  stateSource,
  /experiential_method_impasse_resolution_outcome_evidence:\s*input\.experiential_method_impasse_resolution_outcome_evidence \?\? null/,
);

console.log("Phase79H experiential method impasse resolution outcome evidence tests passed.");
