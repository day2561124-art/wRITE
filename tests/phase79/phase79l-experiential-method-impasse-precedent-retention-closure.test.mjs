import assert from "node:assert/strict";
import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import { worldSimulationExperientialMethodImpasseDeliberationVersion } from "../../server/src/world-simulation-experiential-method-impasse-deliberation-service.mjs";
import { worldSimulationExperientialMethodImpasseDiscriminatingEvidenceVersion } from "../../server/src/world-simulation-experiential-method-impasse-discriminating-evidence-service.mjs";
import { worldSimulationExperientialMethodImpasseReresolutionVersion } from "../../server/src/world-simulation-experiential-method-impasse-reresolution-service.mjs";
import {
  assertWorldSimulationExperientialMethodImpassePrecedentReentryProjection,
  buildWorldSimulationExperientialMethodImpassePrecedentReentryContract,
  projectWorldSimulationExperientialMethodImpassePrecedentReentry,
  worldSimulationExperientialMethodImpassePrecedentReentryVersion,
} from "../../server/src/world-simulation-experiential-method-impasse-precedent-reentry-service.mjs";
import { worldSimulationExperientialMethodImpassePrecedentReresolutionVersion } from "../../server/src/world-simulation-experiential-method-impasse-precedent-reresolution-service.mjs";
import { worldSimulationExperientialMethodImpasseResolutionOutcomeEvidenceVersion } from "../../server/src/world-simulation-experiential-method-impasse-resolution-outcome-evidence-service.mjs";

const sessionId = "world_session_phase79l";
const character = "伊萊亞斯・諾爾";
const historicalTurnId = "turn_phase79l_history";
const currentTurnId = "turn_phase79l_current";
const historicalWorldStateHash = "world_state_hash_phase79l_history";
const currentWorldStateHash = "world_state_hash_phase79l_current";
const historicalImpasseRef = "phase79d_impasse_phase79l_history";
const currentImpasseRef = "phase79d_impasse_phase79l_current";
const historicalTransferA = "phase76e_transfer_phase79l_history_a";
const historicalTransferB = "phase76e_transfer_phase79l_history_b";
const currentTransferA = "phase76e_transfer_phase79l_current_a";
const currentTransferB = "phase76e_transfer_phase79l_current_b";
const historicalCueRef = "phase79e_cue_phase79l_history";
const currentCueRef = "phase79e_cue_phase79l_current";

const methodSkeletonA = Object.freeze({
  relation: "when_context_then_method",
  method_ref: "method_alpha",
  qualifiers: ["narrow_passage", "low_visibility"],
});
const methodSkeletonB = Object.freeze({
  relation: "when_context_then_method",
  method_ref: "method_beta",
  qualifiers: ["narrow_passage"],
});
const routeCueContent = Object.freeze({
  visible_route: "left corridor",
  obstacle: "collapsed beam",
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
function hashed(base, hashField) {
  const value = clone(base);
  value[hashField] = hashAgentRunValue(value);
  return value;
}
function phase79D({ turnId, impasseRef, transferA, transferB } = {}) {
  return hashed({
    version: worldSimulationExperientialMethodImpasseDeliberationVersion,
    character,
    current_turn_id: turnId,
    source_phase79b_resolution_hash: `phase79b_resolution_${turnId}`,
    source_phase79c_guidance_hash: `phase79c_guidance_${turnId}`,
    impasse_contexts: [{
      impasse_ref: impasseRef,
      impasse_type: "tie_impasse",
      retained_method_refs: [transferA, transferB],
      candidate_methods: [
        {
          transfer_ref: transferA,
          method_skeleton: methodSkeletonA,
          source_knowledge_status: "supported",
          current_context_basis: ["perception"],
          current_context_grounded: true,
          advisory_only: true,
        },
        {
          transfer_ref: transferB,
          method_skeleton: methodSkeletonB,
          source_knowledge_status: "supported",
          current_context_basis: ["perception"],
          current_context_grounded: true,
          advisory_only: true,
        },
      ],
    }],
    impasse_count: 1,
    deliberation_required: true,
  }, "impasse_hash");
}
function phase79E({ turnId, impasse, impasseRef, cueRef, cueContent = routeCueContent } = {}) {
  return hashed({
    version: worldSimulationExperientialMethodImpasseDiscriminatingEvidenceVersion,
    character,
    current_turn_id: turnId,
    source_phase79d_impasse_hash: impasse.impasse_hash,
    impasse_evidence_contexts: [{
      impasse_ref: impasseRef,
      current_context_cue_catalog: [{
        cue_ref: cueRef,
        cue_kind: "perception",
        content: cueContent,
        current_turn_only: true,
        character_visible_context_only: true,
        world_truth_authority: false,
      }],
    }],
    impasse_count: 1,
    cue_count: 1,
    deliberation_evidence_available: true,
  }, "evidence_hash");
}
function unresolvedPhase79F({ turnId, impasse, evidence, impasseRef, transferA, transferB } = {}) {
  return hashed({
    version: worldSimulationExperientialMethodImpasseReresolutionVersion,
    character,
    current_turn_id: turnId,
    source_phase79b_resolution_hash: `phase79b_initial_resolution_${turnId}`,
    source_phase79d_impasse_hash: impasse.impasse_hash,
    source_phase79e_evidence_hash: evidence.evidence_hash,
    resolver_view_hash: `phase79f_resolver_view_${turnId}`,
    preference_revision_records: [],
    preference_revision_count: 0,
    effective_competition_resolution: {
      version: "phase79b-experiential-method-competition-resolution-v1",
      resolution_hash: `phase79b_effective_resolution_${turnId}`,
    },
    effective_phase79b_resolution_hash: `phase79b_effective_resolution_${turnId}`,
    impasse_results: [{
      impasse_ref: impasseRef,
      prior_impasse_type: "tie_impasse",
      revised_resolution_ref: `phase79b_tie_${turnId}`,
      resolution_status: "tie_impasse",
      dominant_method_ref: null,
      retained_method_refs: [transferA, transferB],
      applied_preference_revisions: [],
      resolved: false,
    }],
    resolved_impasse_refs: [],
    remaining_impasse_refs: [impasseRef],
    resolved_impasse_count: 0,
    remaining_impasse_count: 1,
    character_view: {
      source: "phase79f_evidence_grounded_experiential_method_impasse_reresolution",
      impasse_results: [],
      deliberation_required: true,
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
  }, "reresolution_hash");
}
function sourcePrecedentCase() {
  const methodSkeletonHash = hashAgentRunValue({
    ...methodSkeletonA,
    qualifiers: [...methodSkeletonA.qualifiers].sort(),
  });
  const cueContentHash = hashAgentRunValue({ cue_kind: "perception", content: routeCueContent });
  const identity = {
    version: worldSimulationExperientialMethodImpassePrecedentReentryVersion,
    current_impasse_ref: historicalImpasseRef,
    source_turn_id: "turn_phase79l_older_source",
    source_revision_to: 3,
    historical_impasse_ref: "phase79d_impasse_phase79l_older_source",
    source_phase79d_impasse_hash: "phase79d_hash_phase79l_older_source",
    source_phase79e_evidence_hash: "phase79e_hash_phase79l_older_source",
    source_phase79f_reresolution_hash: "phase79f_hash_phase79l_older_source",
    source_phase79h_projection_hash: "phase79h_hash_phase79l_older_source",
    source_phase79h_evidence_ref: "phase79h_evidence_phase79l_older_source",
    method_set_hash: "method_set_hash_phase79l_older_source",
    historical_dominant_method_skeleton_hash: methodSkeletonHash,
    current_corresponding_method_ref: historicalTransferA,
    current_corresponding_method_skeleton_hash: methodSkeletonHash,
    method_outcome_assessment: "supports_prior_method",
    precedent_kind: "supported_resolution_selected_method_precedent",
    historical_selected_cues: [{
      historical_cue_ref: "phase79e_cue_phase79l_older_source",
      cue_kind: "perception",
      content: routeCueContent,
      cue_content_hash: cueContentHash,
    }],
    exact_current_cue_match_count: 1,
    exact_current_cue_matches: [{
      historical_cue_ref: "phase79e_cue_phase79l_older_source",
      historical_cue_kind: "perception",
      historical_cue_content_hash: cueContentHash,
      current_cue_ref: historicalCueRef,
      exact_cue_kind_and_content_match: true,
    }],
    all_historical_resolution_cues_exactly_match_current_context: true,
  };
  const precedentHash = hashAgentRunValue(identity);
  return {
    precedent_ref: `phase79i_precedent_${precedentHash.slice(0, 24)}`,
    precedent_hash: precedentHash,
    ...identity,
    comparative_preference_validated: false,
    automatic_current_preference_selected: false,
    counterfactual_superiority_inferred: false,
    world_truth_authority: false,
  };
}
function historicalPhase79I(source79F) {
  const precedent = sourcePrecedentCase();
  return hashed({
    version: worldSimulationExperientialMethodImpassePrecedentReentryVersion,
    world_simulation_session_id: sessionId,
    character,
    current_turn_id: historicalTurnId,
    current_state_revision: 4,
    current_world_state_hash: historicalWorldStateHash,
    source_phase79d_impasse_hash: source79F.source_phase79d_impasse_hash,
    source_phase79e_evidence_hash: source79F.source_phase79e_evidence_hash,
    source_phase79f_reresolution_hash: source79F.reresolution_hash,
    remaining_impasse_refs: [historicalImpasseRef],
    precedent_count: 1,
    precedent_cases: [precedent],
    history_window: {
      total_prior_committed_turn_count: 1,
      scanned_turn_count: 1,
      maximum_history_turns_scanned: 128,
      truncated: false,
      technical_bound_only: true,
      recency_is_not_confidence_or_utility: true,
    },
    audit: {
      same_character_prior_committed_turns_only: true,
      same_turn_history_ignored: true,
      exact_phase79d_phase79e_phase79f_phase79h_history_lineage_required: true,
      exact_normalized_method_skeleton_set_match_required: true,
      transfer_ref_cross_turn_equality_required: false,
      historical_selected_resolution_cues_only: true,
      exact_cue_kind_and_content_matching_only: true,
      fuzzy_semantic_similarity_used: false,
      supported_counterevidenced_and_ambiguous_precedents_retained: true,
      historical_method_outcome_treated_as_counterfactual_comparison: false,
      comparative_preference_validated: false,
      automatic_current_preference_selected: false,
      numeric_success_rate_confidence_probability_utility_reward_modeled: false,
      action_selection_performed: false,
      semantic_revision_performed: false,
      direct_plan_goal_belief_current_mind_world_mutation_performed: false,
      world_truth_authority_claimed: false,
      resolver_used: false,
      same_turn_character_brain_feedback: false,
    },
  }, "projection_hash");
}
function historicalPhase79J(source79F, source79I) {
  const revision = {
    impasse_ref: historicalImpasseRef,
    competition_ref: "phase79a_competition_phase79l_history",
    preference: "left_preferred",
    precedent_refs: [source79I.precedent_cases[0].precedent_ref],
  };
  const result = {
    impasse_ref: historicalImpasseRef,
    prior_impasse_type: "tie_impasse",
    revised_resolution_ref: "phase79b_resolution_phase79l_j",
    resolution_status: "resolved_dominant",
    dominant_method_ref: historicalTransferA,
    retained_method_refs: [historicalTransferA],
    applied_precedent_revisions: [revision],
    resolved: true,
  };
  return hashed({
    version: worldSimulationExperientialMethodImpassePrecedentReresolutionVersion,
    character,
    current_turn_id: historicalTurnId,
    source_phase79b_resolver_view_hash: "phase79b_resolver_view_hash_phase79l_history",
    source_phase79f_reresolution_hash: source79F.reresolution_hash,
    source_phase79i_precedent_reentry_hash: source79I.projection_hash,
    resolver_view_hash: "phase79j_resolver_view_hash_phase79l_history",
    preference_revision_records: [revision],
    preference_revision_count: 1,
    effective_competition_resolution: {
      version: "phase79b-experiential-method-competition-resolution-v1",
      resolution_hash: "phase79b_effective_resolution_hash_phase79l_j",
    },
    effective_phase79b_resolution_hash: "phase79b_effective_resolution_hash_phase79l_j",
    impasse_results: [result],
    resolved_impasse_refs: [historicalImpasseRef],
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
  }, "reresolution_hash");
}
function phase79HFromJ(source79F, source79J) {
  const identity = {
    version: worldSimulationExperientialMethodImpasseResolutionOutcomeEvidenceVersion,
    world_simulation_session_id: sessionId,
    turn_id: historicalTurnId,
    state_revision: 4,
    world_state_hash: historicalWorldStateHash,
    character,
    phase79g_lineage_receipt_id: "phase79g_lineage_phase79l_history",
    phase79g_lineage_receipt_hash: "phase79g_lineage_hash_phase79l_history",
    phase79f_reresolution_hash: source79F.reresolution_hash,
    resolution_source_owner: "Phase79J",
    phase79j_reresolution_hash: source79J.reresolution_hash,
    impasse_ref: historicalImpasseRef,
    prior_impasse_type: "tie_impasse",
    resolution_status: "resolved_dominant",
    dominant_method_ref: historicalTransferA,
    phase76f_application_receipt_id: "phase76f_application_phase79l_history",
    phase76f_application_receipt_hash: "phase76f_application_hash_phase79l_history",
    phase76g_assessment_ref: "phase76g_assessment_phase79l_history",
    phase76g_assessment_hash: "phase76g_assessment_hash_phase79l_history",
    method_outcome_assessment: "supports_prior_method",
    outcome_evidence_kind: "resolution_selected_method_supported_by_subjective_outcome",
  };
  const evidenceHash = hashAgentRunValue(identity);
  const record = {
    evidence_ref: `phase79h_outcome_evidence_${evidenceHash.slice(0, 24)}`,
    evidence_hash: evidenceHash,
    ...identity,
    comparative_preference_validated: false,
    alternative_method_outcomes_observed: false,
    counterfactual_superiority_inferred: false,
    resolution_success_inferred: false,
    resolution_failure_inferred: false,
    preference_retention_performed: false,
    semantic_retention_performed: false,
    semantic_revision_performed: false,
    world_truth_authority: false,
  };
  return hashed({
    version: worldSimulationExperientialMethodImpasseResolutionOutcomeEvidenceVersion,
    world_simulation_session_id: sessionId,
    turn_id: historicalTurnId,
    state_revision: 4,
    world_state_hash: historicalWorldStateHash,
    source_phase79g_receipt_bundle_hash: "phase79g_bundle_hash_phase79l_history",
    source_phase76g_projection_hash: "phase76g_projection_hash_phase79l_history",
    evidence_count: 1,
    evidence_records: [record],
  }, "projection_hash");
}
function historicalJTurn({ cueContent = routeCueContent } = {}) {
  const impasse = phase79D({
    turnId: historicalTurnId,
    impasseRef: historicalImpasseRef,
    transferA: historicalTransferA,
    transferB: historicalTransferB,
  });
  const evidence = phase79E({
    turnId: historicalTurnId,
    impasse,
    impasseRef: historicalImpasseRef,
    cueRef: historicalCueRef,
    cueContent,
  });
  const source79F = unresolvedPhase79F({
    turnId: historicalTurnId,
    impasse,
    evidence,
    impasseRef: historicalImpasseRef,
    transferA: historicalTransferA,
    transferB: historicalTransferB,
  });
  const source79I = historicalPhase79I(source79F);
  const source79J = historicalPhase79J(source79F, source79I);
  const outcome = phase79HFromJ(source79F, source79J);
  return {
    turn_id: historicalTurnId,
    revision_from: 4,
    revision_to: 5,
    previous_state_hash: historicalWorldStateHash,
    next_state_hash: "world_state_hash_phase79l_after_history",
    experiential_method_impasse_deliberation_projections: [impasse],
    experiential_method_impasse_discriminating_evidence_projections: [evidence],
    experiential_method_impasse_reresolution_projections: [source79F],
    experiential_method_impasse_precedent_reentry_projections: [source79I],
    experiential_method_impasse_precedent_reresolution_projections: [source79J],
    experiential_method_impasse_resolution_outcome_evidence: outcome,
  };
}
function currentSources({ cueContent = routeCueContent } = {}) {
  const impasse = phase79D({
    turnId: currentTurnId,
    impasseRef: currentImpasseRef,
    transferA: currentTransferA,
    transferB: currentTransferB,
  });
  const evidence = phase79E({
    turnId: currentTurnId,
    impasse,
    impasseRef: currentImpasseRef,
    cueRef: currentCueRef,
    cueContent,
  });
  const source79F = unresolvedPhase79F({
    turnId: currentTurnId,
    impasse,
    evidence,
    impasseRef: currentImpasseRef,
    transferA: currentTransferA,
    transferB: currentTransferB,
  });
  return { impasse, evidence, source79F };
}
function build({ current = currentSources(), historyTurns = [historicalJTurn()] } = {}) {
  return projectWorldSimulationExperientialMethodImpassePrecedentReentry({
    world_simulation_session_id: sessionId,
    character,
    current_turn_id: currentTurnId,
    current_state_revision: 6,
    current_world_state_hash: currentWorldStateHash,
    world_history: {
      world_simulation_session_id: sessionId,
      turns: historyTurns,
    },
    current_impasse_deliberation: current.impasse,
    current_impasse_discriminating_evidence: current.evidence,
    current_impasse_reresolution: current.source79F,
  });
}

const contract = buildWorldSimulationExperientialMethodImpassePrecedentReentryContract();
assert.deepEqual(contract.supported_historical_resolution_sources, ["Phase79F", "Phase79J"]);
assert.equal(contract.phase79j_history_requires_exact_phase79f_ancestor, true);
assert.equal(contract.phase79j_history_requires_exact_phase79i_source, true);
assert.equal(contract.phase79j_selected_precedent_current_cues_reconstructed, true);
assert.equal(contract.precedent_automatically_selects_preference, false);
assert.equal(contract.precedent_automatically_selects_action, false);
assert.equal(contract.world_truth_authority_claimed, false);

const historyTurn = historicalJTurn();
const projection = build({ historyTurns: [historyTurn] });
assert.equal(projection.precedent_count, 1);
const precedent = projection.precedent_cases[0];
const historical79I = historyTurn.experiential_method_impasse_precedent_reentry_projections[0];
const historical79J = historyTurn.experiential_method_impasse_precedent_reresolution_projections[0];
assert.equal(precedent.resolution_source_owner, "Phase79J");
assert.equal(precedent.source_phase79f_reresolution_hash, historyTurn.experiential_method_impasse_reresolution_projections[0].reresolution_hash);
assert.equal(precedent.source_phase79i_precedent_reentry_hash, historical79I.projection_hash);
assert.equal(precedent.source_phase79j_reresolution_hash, historical79J.reresolution_hash);
assert.equal(precedent.historical_dominant_method_skeleton_hash, hashAgentRunValue({
  ...methodSkeletonA,
  qualifiers: [...methodSkeletonA.qualifiers].sort(),
}));
assert.equal(precedent.current_corresponding_method_ref, currentTransferA);
assert.equal(precedent.historical_selected_cues.length, 1);
assert.equal(precedent.historical_selected_cues[0].historical_cue_ref, historicalCueRef);
assert.notEqual(
  precedent.historical_selected_cues[0].historical_cue_ref,
  historical79I.precedent_cases[0].historical_selected_cues[0].historical_cue_ref,
);
assert.equal(precedent.exact_current_cue_match_count, 1);
assert.equal(precedent.exact_current_cue_matches[0].current_cue_ref, currentCueRef);
assert.equal(precedent.all_historical_resolution_cues_exactly_match_current_context, true);
assert.equal(precedent.comparative_preference_validated, false);
assert.equal(precedent.automatic_current_preference_selected, false);
assert.equal(precedent.counterfactual_superiority_inferred, false);
assert.equal(precedent.world_truth_authority, false);
assert.doesNotThrow(() => assertWorldSimulationExperientialMethodImpassePrecedentReentryProjection(
  projection,
  {
    world_simulation_session_id: sessionId,
    character,
    current_turn_id: currentTurnId,
    current_state_revision: 6,
    current_world_state_hash: currentWorldStateHash,
  },
));

const changedCurrentCue = build({
  current: currentSources({
    cueContent: { visible_route: "right corridor", obstacle: "open" },
  }),
  historyTurns: [historyTurn],
});
assert.equal(changedCurrentCue.precedent_count, 1);
assert.equal(changedCurrentCue.precedent_cases[0].resolution_source_owner, "Phase79J");
assert.equal(changedCurrentCue.precedent_cases[0].exact_current_cue_match_count, 0);
assert.equal(changedCurrentCue.precedent_cases[0].all_historical_resolution_cues_exactly_match_current_context, false);

const wrongPhase79ISourceTurn = historicalJTurn();
const wrongSource79F = wrongPhase79ISourceTurn.experiential_method_impasse_reresolution_projections[0];
const wrong79J = clone(wrongPhase79ISourceTurn.experiential_method_impasse_precedent_reresolution_projections[0]);
wrong79J.source_phase79i_precedent_reentry_hash = "missing_phase79i_source_hash";
delete wrong79J.reresolution_hash;
wrong79J.reresolution_hash = hashAgentRunValue(wrong79J);
wrongPhase79ISourceTurn.experiential_method_impasse_precedent_reresolution_projections = [wrong79J];
wrongPhase79ISourceTurn.experiential_method_impasse_resolution_outcome_evidence = phase79HFromJ(wrongSource79F, wrong79J);
assert.throws(
  () => build({ historyTurns: [wrongPhase79ISourceTurn] }),
  (error) => error?.code === "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_REENTRY_HISTORY_LINEAGE_MISMATCH",
);

const inconsistentRevisionTurn = historicalJTurn();
const inconsistentSource79F = inconsistentRevisionTurn.experiential_method_impasse_reresolution_projections[0];
const inconsistent79J = clone(inconsistentRevisionTurn.experiential_method_impasse_precedent_reresolution_projections[0]);
inconsistent79J.preference_revision_records = [];
inconsistent79J.preference_revision_count = 0;
delete inconsistent79J.reresolution_hash;
inconsistent79J.reresolution_hash = hashAgentRunValue(inconsistent79J);
inconsistentRevisionTurn.experiential_method_impasse_precedent_reresolution_projections = [inconsistent79J];
inconsistentRevisionTurn.experiential_method_impasse_resolution_outcome_evidence = phase79HFromJ(
  inconsistentSource79F,
  inconsistent79J,
);
assert.throws(
  () => build({ historyTurns: [inconsistentRevisionTurn] }),
  (error) => error?.code === "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_REENTRY_HISTORY_PHASE79J_INVALID",
);

const forgedExactCueTurn = historicalJTurn({
  cueContent: { visible_route: "right corridor", obstacle: "open" },
});
assert.throws(
  () => build({ historyTurns: [forgedExactCueTurn] }),
  (error) => error?.code === "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_REENTRY_HISTORY_PHASE79J_CUE_MISMATCH",
);

const missing79JTurn = historicalJTurn();
missing79JTurn.experiential_method_impasse_precedent_reresolution_projections = [];
assert.throws(
  () => build({ historyTurns: [missing79JTurn] }),
  (error) => error?.code === "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_REENTRY_HISTORY_LINEAGE_MISMATCH",
);

console.log("Phase79L Phase79J historical precedent retention re-entry closure tests passed.");
