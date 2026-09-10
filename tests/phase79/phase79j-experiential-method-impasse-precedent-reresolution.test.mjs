import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import {
  projectWorldSimulationExperientialMethodCompetitionResolution,
  worldSimulationExperientialMethodCompetitionResolutionVersion,
} from "../../server/src/world-simulation-experiential-method-competition-resolution-service.mjs";
import { worldSimulationExperientialMethodImpasseReresolutionVersion } from "../../server/src/world-simulation-experiential-method-impasse-reresolution-service.mjs";
import { worldSimulationExperientialMethodImpassePrecedentReentryVersion } from "../../server/src/world-simulation-experiential-method-impasse-precedent-reentry-service.mjs";
import {
  buildWorldSimulationExperientialMethodImpassePrecedentReresolutionContract,
  buildWorldSimulationExperientialMethodImpassePrecedentReresolutionResolverView,
  projectWorldSimulationExperientialMethodImpassePrecedentReresolution,
  worldSimulationExperientialMethodImpassePrecedentReresolutionVersion,
} from "../../server/src/world-simulation-experiential-method-impasse-precedent-reresolution-service.mjs";

const character = "伊萊亞斯・諾爾";
const currentTurnId = "turn_phase79j_current";
const impasseRef = "phase79d_impasse_phase79j";
const competitionRef = "phase79a_competition_phase79j";
const transferA = "phase76e_current_transfer_a";
const transferB = "phase76e_current_transfer_b";
const currentCueRef = "phase79e_current_cue_route";
const historicalCueRef = "phase79e_historical_cue_route";
const currentWorldStateHash = "world_state_hash_phase79j_current";
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
const cueContent = Object.freeze({
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

function phase79BResolverView() {
  return hashed({
    version: worldSimulationExperientialMethodCompetitionResolutionVersion,
    source_phase79a_competition_hash: "phase79a_hash_phase79j",
    character_contexts: [{
      character,
      current_turn_id: currentTurnId,
      source_phase79a_competition_hash: "phase79a_hash_phase79j",
      source_phase76e_transfer_hash: "phase76e_hash_phase79j",
      competing_methods: [
        {
          transfer_ref: transferA,
          method_skeleton: methodSkeletonA,
          mapping_kind: "schema_transfer",
          current_cue_refs: ["phase76e_cue_a"],
          current_context_basis: ["perception"],
          source_knowledge_status: "supported",
          advisory_only: true,
          subjective_not_world_truth: true,
        },
        {
          transfer_ref: transferB,
          method_skeleton: methodSkeletonB,
          mapping_kind: "schema_transfer",
          current_cue_refs: ["phase76e_cue_b"],
          current_context_basis: ["perception"],
          source_knowledge_status: "supported",
          advisory_only: true,
          subjective_not_world_truth: true,
        },
      ],
      competition_pairs: [{
        competition_ref: competitionRef,
        left_transfer_ref: transferA,
        right_transfer_ref: transferB,
        shared_current_cue_refs: [],
        contested_source_present: false,
      }],
      independent_method_refs: [],
      resolution_required: true,
    }],
    selection_contract: {
      competition_ref_must_be_from_view: true,
      exactly_one_preference_per_competition_ref: true,
      supported_preferences: ["left_preferred", "right_preferred", "indifferent", "unresolved"],
      omitted_competition_ref_means_unresolved: true,
      contested_source_may_still_be_preferred: true,
      numeric_preference_or_utility_forbidden: true,
      action_selection_requested: false,
      semantic_revision_requested: false,
      world_truth_judgment_requested: false,
    },
    boundaries: {
      exact_phase79a_source_verified: true,
      exact_phase76e_lineage_verified: true,
      method_semantics_limited_to_verified_phase76e_guidance: true,
      raw_world_state_exposed: false,
      raw_action_outcome_exposed: false,
      hidden_causal_evidence_exposed: false,
      numeric_scores_exposed: false,
      action_candidate_ids_exposed: false,
      same_turn_learning_feedback_exposed: false,
    },
  }, "resolver_view_hash");
}

function phase79F(sourceView) {
  const effective = projectWorldSimulationExperientialMethodCompetitionResolution({
    resolver_view: sourceView,
    preference_decisions: [],
  });
  const component = effective.character_contexts[0].competition_components[0];
  return hashed({
    version: worldSimulationExperientialMethodImpasseReresolutionVersion,
    character,
    current_turn_id: currentTurnId,
    source_phase79b_resolution_hash: "phase79b_initial_resolution_hash",
    source_phase79d_impasse_hash: "phase79d_current_hash",
    source_phase79e_evidence_hash: "phase79e_current_hash",
    resolver_view_hash: "phase79f_resolver_view_hash",
    preference_revision_records: [],
    preference_revision_count: 0,
    effective_competition_resolution: effective,
    effective_phase79b_resolution_hash: effective.resolution_hash,
    impasse_results: [{
      impasse_ref: impasseRef,
      prior_impasse_type: "tie_impasse",
      revised_resolution_ref: component.resolution_ref,
      resolution_status: component.resolution_status,
      dominant_method_ref: null,
      retained_method_refs: [transferA, transferB].sort(),
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
      existing_phase79b_resolution_kernel_reused: true,
    },
  }, "reresolution_hash");
}

function precedentCase({
  outcome = "supports_prior_method",
  currentMethodRef = transferA,
  fullCueMatch = true,
} = {}) {
  const methodSkeleton = currentMethodRef === transferA ? methodSkeletonA : methodSkeletonB;
  const methodSkeletonHash = hashAgentRunValue(methodSkeleton);
  const cueContentHash = hashAgentRunValue({ cue_kind: "perception", content: cueContent });
  const identity = {
    version: worldSimulationExperientialMethodImpassePrecedentReentryVersion,
    current_impasse_ref: impasseRef,
    source_turn_id: "turn_phase79j_history",
    source_revision_to: 4,
    historical_impasse_ref: "phase79d_impasse_history",
    source_phase79d_impasse_hash: "phase79d_history_hash",
    source_phase79e_evidence_hash: "phase79e_history_hash",
    source_phase79f_reresolution_hash: "phase79f_history_hash",
    source_phase79h_projection_hash: "phase79h_history_hash",
    source_phase79h_evidence_ref: "phase79h_history_evidence_ref",
    method_set_hash: "method_set_hash_phase79j",
    historical_dominant_method_skeleton_hash: methodSkeletonHash,
    current_corresponding_method_ref: currentMethodRef,
    current_corresponding_method_skeleton_hash: methodSkeletonHash,
    method_outcome_assessment: outcome,
    precedent_kind: outcome === "supports_prior_method"
      ? "supported_resolution_selected_method_precedent"
      : outcome === "counterevidence_for_prior_method"
        ? "counterevidenced_resolution_selected_method_precedent"
        : "ambiguous_resolution_selected_method_precedent",
    historical_selected_cues: [{
      historical_cue_ref: historicalCueRef,
      cue_kind: "perception",
      content: cueContent,
      cue_content_hash: cueContentHash,
    }],
    exact_current_cue_match_count: fullCueMatch ? 1 : 0,
    exact_current_cue_matches: fullCueMatch
      ? [{
        historical_cue_ref: historicalCueRef,
        historical_cue_kind: "perception",
        historical_cue_content_hash: cueContentHash,
        current_cue_ref: currentCueRef,
        exact_cue_kind_and_content_match: true,
      }]
      : [],
    all_historical_resolution_cues_exactly_match_current_context: fullCueMatch,
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

function phase79I(phase79f, precedents) {
  return hashed({
    version: worldSimulationExperientialMethodImpassePrecedentReentryVersion,
    world_simulation_session_id: "world_session_phase79j",
    character,
    current_turn_id: currentTurnId,
    current_state_revision: 5,
    current_world_state_hash: currentWorldStateHash,
    source_phase79d_impasse_hash: phase79f.source_phase79d_impasse_hash,
    source_phase79e_evidence_hash: phase79f.source_phase79e_evidence_hash,
    source_phase79f_reresolution_hash: phase79f.reresolution_hash,
    remaining_impasse_refs: [impasseRef],
    precedent_count: precedents.length,
    precedent_cases: precedents,
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

function sources({ precedents = [precedentCase()] } = {}) {
  const sourceView = phase79BResolverView();
  const source79F = phase79F(sourceView);
  const source79I = phase79I(source79F, precedents);
  return { sourceView, source79F, source79I };
}

function buildView(sourceSet = sources()) {
  return buildWorldSimulationExperientialMethodImpassePrecedentReresolutionResolverView({
    source_phase79b_resolver_view: sourceSet.sourceView,
    source_phase79f_reresolution: sourceSet.source79F,
    source_phase79i_precedent_reentry: sourceSet.source79I,
  });
}

function resolve(sourceSet, preferenceRevisions) {
  const resolverView = buildView(sourceSet);
  return projectWorldSimulationExperientialMethodImpassePrecedentReresolution({
    resolver_view: resolverView,
    source_phase79b_resolver_view: sourceSet.sourceView,
    source_phase79f_reresolution: sourceSet.source79F,
    source_phase79i_precedent_reentry: sourceSet.source79I,
    preference_revisions: preferenceRevisions,
  });
}

const contract = buildWorldSimulationExperientialMethodImpassePrecedentReresolutionContract();
assert.equal(contract.version, worldSimulationExperientialMethodImpassePrecedentReresolutionVersion);
assert.equal(contract.phase, "Phase79J");
assert.equal(contract.phase79f_remaining_impasses_only, true);
assert.equal(contract.phase79i_exact_full_cue_match_precedents_only, true);
assert.equal(contract.existing_phase79b_resolution_kernel_reused, true);
assert.equal(contract.automatic_precedent_voting_allowed, false);
assert.equal(contract.fuzzy_similarity_allowed, false);
assert.equal(contract.historical_outcome_is_comparative_truth, false);
assert.equal(contract.direct_action_selection_allowed, false);
assert.equal(contract.numeric_success_rate_confidence_probability_utility_reward_modeled, false);

const supportedSources = sources();
const supportedView = buildView(supportedSources);
assert.equal(supportedView.impasse_count, 1);
assert.equal(supportedView.eligible_precedent_count, 1);
assert.equal(supportedView.impasse_contexts[0].eligible_precedents.length, 1);
assert.equal(supportedView.impasse_contexts[0].eligible_precedents[0].current_corresponding_method_ref, transferA);
assert.equal(supportedView.boundaries.raw_world_history_exposed, false);
assert.equal(supportedView.boundaries.raw_world_state_exposed, false);
assert.equal(supportedView.boundaries.raw_action_outcome_exposed, false);
assert.equal(supportedView.boundaries.fuzzy_similarity_exposed, false);
assert.equal(
  Object.hasOwn(supportedView.impasse_contexts[0].eligible_precedents[0], "historical_transfer_ref"),
  false,
);
assert.equal(
  Object.hasOwn(supportedView.impasse_contexts[0].eligible_precedents[0], "source_turn_id"),
  false,
);

const supportPrecedentRef = supportedView.impasse_contexts[0].eligible_precedents[0].precedent_ref;
const supportedResult = resolve(supportedSources, [{
  impasse_ref: impasseRef,
  competition_ref: competitionRef,
  preference: "left_preferred",
  precedent_refs: [supportPrecedentRef],
}]);
assert.equal(supportedResult.resolved_impasse_count, 1);
assert.equal(supportedResult.remaining_impasse_count, 0);
assert.equal(supportedResult.impasse_results[0].resolution_status, "resolved_dominant");
assert.equal(supportedResult.impasse_results[0].dominant_method_ref, transferA);
assert.deepEqual(supportedResult.impasse_results[0].applied_precedent_revisions[0].precedent_refs, [supportPrecedentRef]);
assert.equal(supportedResult.audit.existing_phase79b_resolution_kernel_reused, true);
assert.equal(supportedResult.audit.automatic_precedent_voting_used, false);
assert.equal(supportedResult.audit.historical_outcome_treated_as_comparative_truth, false);
assert.equal(supportedResult.character_view.precedent_refs_exposed, false);
assert.equal(JSON.stringify(supportedResult.character_view).includes(supportPrecedentRef), false);

const noRevisionResult = resolve(supportedSources, []);
assert.equal(noRevisionResult.resolved_impasse_count, 0);
assert.equal(noRevisionResult.remaining_impasse_count, 1);
assert.equal(noRevisionResult.impasse_results[0].resolution_status, "tie_impasse");

assert.throws(
  () => resolve(supportedSources, [{
    impasse_ref: impasseRef,
    competition_ref: competitionRef,
    preference: "right_preferred",
    precedent_refs: [supportPrecedentRef],
  }]),
  (error) => error?.code
    === "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_RERESOLUTION_DIRECTION_UNSUPPORTED",
);

const counterSources = sources({
  precedents: [precedentCase({
    outcome: "counterevidence_for_prior_method",
    currentMethodRef: transferA,
  })],
});
const counterRef = buildView(counterSources).impasse_contexts[0].eligible_precedents[0].precedent_ref;
const counterResult = resolve(counterSources, [{
  impasse_ref: impasseRef,
  competition_ref: competitionRef,
  preference: "right_preferred",
  precedent_refs: [counterRef],
}]);
assert.equal(counterResult.impasse_results[0].dominant_method_ref, transferB);

const ambiguousSources = sources({
  precedents: [precedentCase({
    outcome: "ambiguous_no_revision",
    currentMethodRef: transferA,
  })],
});
const ambiguousRef = buildView(ambiguousSources).impasse_contexts[0].eligible_precedents[0].precedent_ref;
assert.throws(
  () => resolve(ambiguousSources, [{
    impasse_ref: impasseRef,
    competition_ref: competitionRef,
    preference: "left_preferred",
    precedent_refs: [ambiguousRef],
  }]),
  (error) => error?.code
    === "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_RERESOLUTION_DIRECTION_UNSUPPORTED",
);
const indifferentResult = resolve(ambiguousSources, [{
  impasse_ref: impasseRef,
  competition_ref: competitionRef,
  preference: "indifferent",
  precedent_refs: [ambiguousRef],
}]);
assert.equal(indifferentResult.impasse_results[0].resolution_status, "indifferent_set");

const partialSources = sources({
  precedents: [precedentCase({ fullCueMatch: false })],
});
const partialView = buildView(partialSources);
assert.equal(partialView.eligible_precedent_count, 0);
const partialRef = partialSources.source79I.precedent_cases[0].precedent_ref;
assert.throws(
  () => resolve(partialSources, [{
    impasse_ref: impasseRef,
    competition_ref: competitionRef,
    preference: "left_preferred",
    precedent_refs: [partialRef],
  }]),
  (error) => error?.code
    === "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_RERESOLUTION_PRECEDENT_EVIDENCE_OUT_OF_VIEW",
);

assert.throws(
  () => resolve(supportedSources, [{
    impasse_ref: impasseRef,
    competition_ref: competitionRef,
    preference: "left_preferred",
    precedent_refs: [supportPrecedentRef],
    utility: 1,
  }]),
  (error) => error?.code
    === "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_RERESOLUTION_AUTHORITY_FIELD_FORBIDDEN",
);
assert.throws(
  () => resolve(supportedSources, [{
    impasse_ref: impasseRef,
    competition_ref: competitionRef,
    preference: "left_preferred",
    precedent_refs: [supportPrecedentRef],
    selected_action: "attack",
  }]),
  (error) => error?.code
    === "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_RERESOLUTION_AUTHORITY_FIELD_FORBIDDEN",
);

const tamperedSources = sources();
tamperedSources.source79I = clone(tamperedSources.source79I);
tamperedSources.source79I.precedent_cases[0].method_outcome_assessment = "counterevidence_for_prior_method";
assert.throws(
  () => buildView(tamperedSources),
  (error) => error?.code === "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_REENTRY_HASH_MISMATCH",
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
const phase79fIndex = loopSource.indexOf("const experientialMethodImpasseReresolution =");
const phase79iIndex = loopSource.indexOf(
  "const experientialMethodImpassePrecedentReentry =",
  phase79fIndex,
);
const phase79jIndex = loopSource.indexOf(
  "const experientialMethodImpassePrecedentReresolution =",
  phase79iIndex,
);
const actionProposerIndex = loopSource.indexOf('"world_action_proposer"', phase79jIndex);
assert.ok(
  phase79fIndex >= 0
    && phase79iIndex > phase79fIndex
    && phase79jIndex > phase79iIndex
    && actionProposerIndex > phase79jIndex,
);
assert.match(
  loopSource,
  /experientialMethodImpassePrecedentReresolutionResolver/,
);
assert.match(
  loopSource,
  /experiential_method_impasse_precedent_reresolution_projections:\s*cloneJson\(experientialMethodImpassePrecedentReresolutionProjections\)/,
);
assert.match(
  loopSource,
  /preparedTurn\.experiential_method_impasse_precedent_reresolution_projections \?\? \[\]/,
);
assert.match(
  stateSource,
  /experiential_method_impasse_precedent_reresolution_projections:\s*input\.experiential_method_impasse_precedent_reresolution_projections \?\? null/,
);
assert.doesNotMatch(
  loopSource,
  /characterCognition\.experiential_method_impasse_precedent_reentry/,
);
assert.match(
  loopSource,
  /precedent_refs_exposed:\s*false/,
);

console.log("Phase79J experiential method impasse precedent re-resolution tests passed.");
