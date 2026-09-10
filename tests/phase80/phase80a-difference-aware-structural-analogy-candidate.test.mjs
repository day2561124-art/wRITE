import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import {
  assertWorldSimulationAnalogicalExperienceCandidateProjection,
  buildWorldSimulationAnalogicalExperienceCandidateContract,
  projectWorldSimulationAnalogicalExperienceCandidates,
  worldSimulationAnalogicalExperienceCandidateVersion,
} from "../../server/src/world-simulation-analogical-experience-candidate-service.mjs";
import { worldSimulationExperientialMethodImpasseDiscriminatingEvidenceVersion } from "../../server/src/world-simulation-experiential-method-impasse-discriminating-evidence-service.mjs";
import { worldSimulationExperientialMethodImpassePrecedentReentryVersion } from "../../server/src/world-simulation-experiential-method-impasse-precedent-reentry-service.mjs";

const character = "伊萊亞斯・諾爾";
const currentTurnId = "turn_phase80a_current";
const currentStateRevision = 9;
const currentWorldStateHash = "world_state_hash_phase80a_current";
const currentImpasseRef = "phase79d_impasse_phase80a_current";
const currentRouteCueRef = "phase79e_current_route";
const currentThreatCueRef = "phase79e_current_threat";
const historicalRouteCueRef = "phase79e_historical_route";
const historicalVisibilityCueRef = "phase79e_historical_visibility";
const methodSkeletonHash = "method_skeleton_hash_alpha";

function hashed(base, hashField) {
  const value = structuredClone(base);
  value[hashField] = hashAgentRunValue(value);
  return value;
}

function currentEvidence() {
  return hashed({
    version: worldSimulationExperientialMethodImpasseDiscriminatingEvidenceVersion,
    character,
    current_turn_id: currentTurnId,
    source_phase79d_impasse_hash: "phase79d_hash_phase80a_current",
    impasse_evidence_contexts: [{
      impasse_ref: currentImpasseRef,
      current_context_cue_catalog: [
        {
          cue_ref: currentRouteCueRef,
          cue_kind: "perception",
          content: { route: "left corridor", obstruction: "collapsed beam" },
          current_turn_only: true,
          character_visible_context_only: true,
          world_truth_authority: false,
        },
        {
          cue_ref: currentThreatCueRef,
          cue_kind: "working_context",
          content: { nearby_threat: "closing distance" },
          current_turn_only: true,
          character_visible_context_only: true,
          world_truth_authority: false,
        },
      ],
    }],
    impasse_count: 1,
    cue_count: 2,
    deliberation_evidence_available: true,
  }, "evidence_hash");
}

function historicalCue(ref, cueKind, content) {
  return {
    historical_cue_ref: ref,
    cue_kind: cueKind,
    content: structuredClone(content),
    cue_content_hash: hashAgentRunValue({ cue_kind: cueKind, content }),
  };
}

function precedent({
  suffix,
  fullMatch,
  assessment = "supports_prior_method",
} = {}) {
  const routeContent = { route: "left corridor", obstruction: "collapsed beam" };
  const secondCue = fullMatch
    ? historicalCue(
        historicalVisibilityCueRef,
        "working_context",
        { nearby_threat: "closing distance" },
      )
    : historicalCue(historicalVisibilityCueRef, "attention", { visibility: "low" });
  const selectedCues = [
    historicalCue(historicalRouteCueRef, "perception", routeContent),
    secondCue,
  ];
  const exactMatches = [{
    historical_cue_ref: historicalRouteCueRef,
    historical_cue_kind: "perception",
    historical_cue_content_hash: selectedCues[0].cue_content_hash,
    current_cue_ref: currentRouteCueRef,
    exact_cue_kind_and_content_match: true,
  }];
  if (fullMatch) {
    exactMatches.push({
      historical_cue_ref: historicalVisibilityCueRef,
      historical_cue_kind: "working_context",
      historical_cue_content_hash: selectedCues[1].cue_content_hash,
      current_cue_ref: currentThreatCueRef,
      exact_cue_kind_and_content_match: true,
    });
  }
  const precedentKind = assessment === "supports_prior_method"
    ? "supported_resolution_selected_method_precedent"
    : assessment === "counterevidence_for_prior_method"
      ? "counterevidenced_resolution_selected_method_precedent"
      : "ambiguous_resolution_selected_method_precedent";
  const identity = {
    version: worldSimulationExperientialMethodImpassePrecedentReentryVersion,
    current_impasse_ref: currentImpasseRef,
    source_turn_id: `turn_phase80a_history_${suffix}`,
    source_revision_to: 7,
    historical_impasse_ref: `phase79d_impasse_history_${suffix}`,
    source_phase79d_impasse_hash: `phase79d_hash_history_${suffix}`,
    source_phase79e_evidence_hash: `phase79e_hash_history_${suffix}`,
    source_phase79f_reresolution_hash: `phase79f_hash_history_${suffix}`,
    source_phase79h_projection_hash: `phase79h_hash_history_${suffix}`,
    source_phase79h_evidence_ref: `phase79h_evidence_${suffix}`,
    method_set_hash: "method_set_hash_shared",
    historical_dominant_method_skeleton_hash: methodSkeletonHash,
    current_corresponding_method_ref: "phase76e_current_transfer_alpha",
    current_corresponding_method_skeleton_hash: methodSkeletonHash,
    method_outcome_assessment: assessment,
    precedent_kind: precedentKind,
    historical_selected_cues: selectedCues,
    exact_current_cue_match_count: exactMatches.length,
    exact_current_cue_matches: exactMatches,
    all_historical_resolution_cues_exactly_match_current_context: fullMatch,
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

function phase79I(precedentCases) {
  const projection = {
    version: worldSimulationExperientialMethodImpassePrecedentReentryVersion,
    world_simulation_session_id: "world_session_phase80a",
    character,
    current_turn_id: currentTurnId,
    current_state_revision: currentStateRevision,
    current_world_state_hash: currentWorldStateHash,
    source_phase79d_impasse_hash: "phase79d_hash_phase80a_current",
    source_phase79e_evidence_hash: currentEvidence().evidence_hash,
    source_phase79f_reresolution_hash: "phase79f_hash_phase80a_current",
    remaining_impasse_refs: [currentImpasseRef],
    precedent_count: precedentCases.length,
    precedent_cases: structuredClone(precedentCases),
    history_window: {
      total_prior_committed_turn_count: 2,
      scanned_turn_count: 2,
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
      comparative_preference_validated: false,
      automatic_current_preference_selected: false,
      numeric_success_rate_confidence_probability_utility_reward_modeled: false,
      action_selection_performed: false,
      semantic_revision_performed: false,
      world_truth_authority_claimed: false,
      resolver_used: false,
      same_turn_character_brain_feedback: false,
    },
  };
  projection.projection_hash = hashAgentRunValue(projection);
  return projection;
}

const contract = buildWorldSimulationAnalogicalExperienceCandidateContract();
assert.equal(contract.version, worldSimulationAnalogicalExperienceCandidateVersion);
assert.equal(contract.phase, "Phase80A");
assert.equal(contract.phase79i_exact_method_skeleton_identity_preserved, true);
assert.equal(contract.phase79j_exact_full_cue_match_cases_excluded, true);
assert.equal(contract.near_miss_context_difference_required, true);
assert.equal(contract.adaptation_required_before_reuse, true);
assert.equal(contract.direct_reuse_allowed, false);
assert.equal(contract.preference_resolution_performed, false);
assert.equal(contract.action_selection_performed, false);
assert.equal(contract.numeric_similarity_confidence_probability_utility_reward_modeled, false);
assert.equal(contract.fuzzy_semantic_similarity_modeled, false);
assert.equal(contract.character_brain_exposure_allowed, false);

const evidence = currentEvidence();

const nearMiss = precedent({ suffix: "near", fullMatch: false });
const exactMatch = precedent({ suffix: "exact", fullMatch: true });
const reentry = phase79I([nearMiss, exactMatch]);
reentry.source_phase79e_evidence_hash = evidence.evidence_hash;
delete reentry.projection_hash;
reentry.projection_hash = hashAgentRunValue(reentry);

const projection = projectWorldSimulationAnalogicalExperienceCandidates({
  source_phase79e_discriminating_evidence: evidence,
  source_phase79i_precedent_reentry: reentry,
});
assert.equal(projection.analogy_candidate_count, 1);
assert.equal(projection.source_phase79i_precedent_count, 2);
assert.equal(projection.source_phase79i_exact_full_cue_match_count, 1);
assert.equal(projection.source_phase79i_near_miss_count, 1);

const candidate = projection.analogy_candidates[0];
assert.equal(candidate.source_phase79i_precedent_ref, nearMiss.precedent_ref);
assert.equal(candidate.alignment_kind, "exact_method_structure_with_context_difference");
assert.equal(candidate.exact_method_structure_alignment, true);
assert.equal(candidate.aligned_cue_count, 1);
assert.equal(candidate.aligned_cue_pairs[0].historical_cue_ref, historicalRouteCueRef);
assert.equal(candidate.aligned_cue_pairs[0].current_cue_ref, currentRouteCueRef);
assert.equal(candidate.historical_unmatched_cue_count, 1);
assert.equal(candidate.historical_unmatched_cues[0].historical_cue_ref, historicalVisibilityCueRef);
assert.equal(candidate.current_additional_cue_count, 1);
assert.deepEqual(
  candidate.current_additional_cues.map((cue) => cue.current_cue_ref),
  [currentThreatCueRef],
);
assert.equal(candidate.context_difference_present, true);
assert.equal(candidate.adaptation_required, true);
assert.equal(candidate.direct_reuse_allowed, false);
assert.equal(candidate.comparative_preference_validated, false);
assert.equal(candidate.automatic_preference_selected, false);
assert.equal(candidate.action_selection_performed, false);
assert.equal(candidate.semantic_revision_performed, false);
assert.equal(candidate.world_truth_authority, false);
assert.equal(projection.audit.fuzzy_semantic_similarity_used, false);
assert.equal(projection.audit.numeric_similarity_confidence_probability_utility_reward_modeled, false);
assert.equal(projection.audit.character_brain_exposure_performed, false);
assert.doesNotThrow(() => assertWorldSimulationAnalogicalExperienceCandidateProjection(
  projection,
  {
    character,
    current_turn_id: currentTurnId,
    current_state_revision: currentStateRevision,
    current_world_state_hash: currentWorldStateHash,
  },
));

const exactOnly = phase79I([exactMatch]);
exactOnly.source_phase79e_evidence_hash = evidence.evidence_hash;
delete exactOnly.projection_hash;
exactOnly.projection_hash = hashAgentRunValue(exactOnly);
const exactOnlyProjection = projectWorldSimulationAnalogicalExperienceCandidates({
  source_phase79e_discriminating_evidence: evidence,
  source_phase79i_precedent_reentry: exactOnly,
});
assert.equal(exactOnlyProjection.analogy_candidate_count, 0);
assert.equal(exactOnlyProjection.source_phase79i_exact_full_cue_match_count, 1);

const counterevidenceNearMiss = precedent({
  suffix: "counter",
  fullMatch: false,
  assessment: "counterevidence_for_prior_method",
});
const counterReentry = phase79I([counterevidenceNearMiss]);
counterReentry.source_phase79e_evidence_hash = evidence.evidence_hash;
delete counterReentry.projection_hash;
counterReentry.projection_hash = hashAgentRunValue(counterReentry);
const counterProjection = projectWorldSimulationAnalogicalExperienceCandidates({
  source_phase79e_discriminating_evidence: evidence,
  source_phase79i_precedent_reentry: counterReentry,
});
assert.equal(counterProjection.analogy_candidates[0].method_outcome_assessment, "counterevidence_for_prior_method");
assert.equal(counterProjection.analogy_candidates[0].automatic_preference_selected, false);

const staleCandidateLineage = structuredClone(projection);
staleCandidateLineage.analogy_candidates[0].source_current_state_revision += 1;
delete staleCandidateLineage.projection_hash;
staleCandidateLineage.projection_hash = hashAgentRunValue(staleCandidateLineage);
assert.throws(
  () => assertWorldSimulationAnalogicalExperienceCandidateProjection(staleCandidateLineage),
  (error) => error?.code === "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_CANDIDATE_INVALID",
);

const tamperedReentry = structuredClone(reentry);
tamperedReentry.precedent_cases[0].historical_selected_cues[1].content = { visibility: "bright" };
assert.throws(
  () => projectWorldSimulationAnalogicalExperienceCandidates({
    source_phase79e_discriminating_evidence: evidence,
    source_phase79i_precedent_reentry: tamperedReentry,
  }),
  (error) => error?.code === "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_REENTRY_HASH_MISMATCH",
);

const staleEvidence = structuredClone(evidence);
staleEvidence.impasse_evidence_contexts[0].current_context_cue_catalog[0].content = { route: "right" };
assert.throws(
  () => projectWorldSimulationAnalogicalExperienceCandidates({
    source_phase79e_discriminating_evidence: staleEvidence,
    source_phase79i_precedent_reentry: reentry,
  }),
  (error) => error?.code === "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_CANDIDATE_PHASE79E_INVALID",
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
const phase79iIndex = loopSource.indexOf("const experientialMethodImpassePrecedentReentry =");
const phase80aIndex = loopSource.indexOf("const analogicalExperienceCandidate =", phase79iIndex);
const phase79jIndex = loopSource.indexOf(
  "const experientialMethodImpassePrecedentReresolutionResolverView =",
  phase80aIndex,
);
assert.ok(phase79iIndex >= 0 && phase80aIndex > phase79iIndex && phase79jIndex > phase80aIndex);
assert.match(
  loopSource,
  /analogical_experience_candidate_projections:\s*cloneJson\(analogicalExperienceCandidateProjections\)/,
);
assert.match(
  loopSource,
  /preparedTurn\.analogical_experience_candidate_projections \?\? \[\]/,
);
assert.match(
  stateSource,
  /analogical_experience_candidate_projections:\s*input\.analogical_experience_candidate_projections \?\? null/,
);
assert.doesNotMatch(loopSource, /characterCognition\.analogical_experience/);

console.log("Phase80A difference-aware structural analogy candidate tests passed.");
