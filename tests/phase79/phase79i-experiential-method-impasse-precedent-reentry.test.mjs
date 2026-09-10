import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import { worldSimulationExperientialMethodImpasseDeliberationVersion } from "../../server/src/world-simulation-experiential-method-impasse-deliberation-service.mjs";
import { worldSimulationExperientialMethodImpasseDiscriminatingEvidenceVersion } from "../../server/src/world-simulation-experiential-method-impasse-discriminating-evidence-service.mjs";
import { worldSimulationExperientialMethodImpasseReresolutionVersion } from "../../server/src/world-simulation-experiential-method-impasse-reresolution-service.mjs";
import { worldSimulationExperientialMethodImpasseResolutionOutcomeEvidenceVersion } from "../../server/src/world-simulation-experiential-method-impasse-resolution-outcome-evidence-service.mjs";
import {
  assertWorldSimulationExperientialMethodImpassePrecedentReentryProjection,
  buildWorldSimulationExperientialMethodImpassePrecedentReentryContract,
  projectWorldSimulationExperientialMethodImpassePrecedentReentry,
  worldSimulationExperientialMethodImpassePrecedentReentryVersion,
} from "../../server/src/world-simulation-experiential-method-impasse-precedent-reentry-service.mjs";

const sessionId = "world_session_phase79i";
const character = "伊萊亞斯・諾爾";
const currentTurnId = "turn_phase79i_current";
const historicalTurnId = "turn_phase79i_history";
const currentStateRevision = 6;
const currentWorldStateHash = "world_state_hash_phase79i_current";
const historicalWorldStateHash = "world_state_hash_phase79i_history";
const currentImpasseRef = "phase79d_impasse_current";
const historicalImpasseRef = "phase79d_impasse_history";
const currentTransferA = "phase76e_current_transfer_a";
const currentTransferB = "phase76e_current_transfer_b";
const historicalTransferA = "phase76e_historical_transfer_a";
const historicalTransferB = "phase76e_historical_transfer_b";
const currentCueRef = "phase79e_current_cue_route";
const historicalCueRef = "phase79e_historical_cue_route";

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

function hashed(base, hashField) {
  const value = JSON.parse(JSON.stringify(base));
  value[hashField] = hashAgentRunValue(value);
  return value;
}

function phase79D({
  turnId,
  impasseRef,
  transferA,
  transferB,
  skeletonA = methodSkeletonA,
  skeletonB = methodSkeletonB,
} = {}) {
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
          method_skeleton: skeletonA,
          source_knowledge_status: "supported",
          current_context_basis: ["perception"],
          current_context_grounded: true,
          advisory_only: true,
        },
        {
          transfer_ref: transferB,
          method_skeleton: skeletonB,
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

function phase79E({
  turnId,
  impasse,
  impasseRef,
  cueRef,
  cueContent = routeCueContent,
} = {}) {
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

function phase79FCurrent({ impasse, evidence, remaining = true } = {}) {
  return hashed({
    version: worldSimulationExperientialMethodImpasseReresolutionVersion,
    character,
    current_turn_id: currentTurnId,
    source_phase79d_impasse_hash: impasse.impasse_hash,
    source_phase79e_evidence_hash: evidence.evidence_hash,
    remaining_impasse_refs: remaining ? [currentImpasseRef] : [],
    remaining_impasse_count: remaining ? 1 : 0,
    resolved_impasse_refs: [],
    resolved_impasse_count: 0,
  }, "reresolution_hash");
}

function phase79FHistorical({ impasse, evidence, dominantTransfer = historicalTransferA } = {}) {
  return hashed({
    version: worldSimulationExperientialMethodImpasseReresolutionVersion,
    character,
    current_turn_id: historicalTurnId,
    source_phase79d_impasse_hash: impasse.impasse_hash,
    source_phase79e_evidence_hash: evidence.evidence_hash,
    impasse_results: [{
      impasse_ref: historicalImpasseRef,
      prior_impasse_type: "tie_impasse",
      resolution_status: "resolved_dominant",
      dominant_method_ref: dominantTransfer,
      applied_preference_revisions: [{
        competition_ref: "phase79a_historical_competition",
        preference: "left_preferred",
        evidence_cue_refs: [historicalCueRef],
      }],
      resolved: true,
    }],
    remaining_impasse_refs: [],
    resolved_impasse_refs: [historicalImpasseRef],
    remaining_impasse_count: 0,
    resolved_impasse_count: 1,
  }, "reresolution_hash");
}

function outcomeEvidenceKind(assessment) {
  if (assessment === "supports_prior_method") {
    return "resolution_selected_method_supported_by_subjective_outcome";
  }
  if (assessment === "counterevidence_for_prior_method") {
    return "resolution_selected_method_counterevidenced_by_subjective_outcome";
  }
  return "resolution_selected_method_outcome_ambiguous";
}

function phase79H({ phase79f, assessment = "supports_prior_method" } = {}) {
  const identity = {
    version: worldSimulationExperientialMethodImpasseResolutionOutcomeEvidenceVersion,
    world_simulation_session_id: sessionId,
    turn_id: historicalTurnId,
    state_revision: 4,
    world_state_hash: historicalWorldStateHash,
    character,
    phase79g_lineage_receipt_id: "phase79g_lineage_history",
    phase79g_lineage_receipt_hash: "phase79g_lineage_hash_history",
    phase79f_reresolution_hash: phase79f.reresolution_hash,
    impasse_ref: historicalImpasseRef,
    prior_impasse_type: "tie_impasse",
    resolution_status: "resolved_dominant",
    dominant_method_ref: historicalTransferA,
    phase76f_application_receipt_id: "phase76f_application_history",
    phase76f_application_receipt_hash: "phase76f_application_hash_history",
    phase76g_assessment_ref: "phase76g_assessment_history",
    phase76g_assessment_hash: "phase76g_assessment_hash_history",
    method_outcome_assessment: assessment,
    outcome_evidence_kind: outcomeEvidenceKind(assessment),
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
    source_phase79g_receipt_bundle_hash: "phase79g_bundle_history",
    source_phase76g_projection_hash: "phase76g_projection_history",
    evidence_count: 1,
    evidence_records: [record],
  }, "projection_hash");
}

function historicalTurn({
  assessment = "supports_prior_method",
  historicalCueContent = routeCueContent,
  skeletonA = methodSkeletonA,
  skeletonB = methodSkeletonB,
} = {}) {
  const impasse = phase79D({
    turnId: historicalTurnId,
    impasseRef: historicalImpasseRef,
    transferA: historicalTransferA,
    transferB: historicalTransferB,
    skeletonA,
    skeletonB,
  });
  const evidence = phase79E({
    turnId: historicalTurnId,
    impasse,
    impasseRef: historicalImpasseRef,
    cueRef: historicalCueRef,
    cueContent: historicalCueContent,
  });
  const reresolution = phase79FHistorical({ impasse, evidence });
  const outcome = phase79H({ phase79f: reresolution, assessment });
  return {
    turn_id: historicalTurnId,
    revision_from: 4,
    revision_to: 5,
    previous_state_hash: historicalWorldStateHash,
    next_state_hash: "world_state_hash_phase79i_after_history",
    experiential_method_impasse_deliberation_projections: [impasse],
    experiential_method_impasse_discriminating_evidence_projections: [evidence],
    experiential_method_impasse_reresolution_projections: [reresolution],
    experiential_method_impasse_resolution_outcome_evidence: outcome,
  };
}

function currentSources({
  cueContent = routeCueContent,
  remaining = true,
  skeletonA = methodSkeletonA,
  skeletonB = methodSkeletonB,
} = {}) {
  const impasse = phase79D({
    turnId: currentTurnId,
    impasseRef: currentImpasseRef,
    transferA: currentTransferA,
    transferB: currentTransferB,
    skeletonA,
    skeletonB,
  });
  const evidence = phase79E({
    turnId: currentTurnId,
    impasse,
    impasseRef: currentImpasseRef,
    cueRef: currentCueRef,
    cueContent,
  });
  const reresolution = phase79FCurrent({ impasse, evidence, remaining });
  return { impasse, evidence, reresolution };
}

function build({ current = currentSources(), historyTurns = [historicalTurn()] } = {}) {
  return projectWorldSimulationExperientialMethodImpassePrecedentReentry({
    world_simulation_session_id: sessionId,
    character,
    current_turn_id: currentTurnId,
    current_state_revision: currentStateRevision,
    current_world_state_hash: currentWorldStateHash,
    world_history: {
      world_simulation_session_id: sessionId,
      turns: historyTurns,
    },
    current_impasse_deliberation: current.impasse,
    current_impasse_discriminating_evidence: current.evidence,
    current_impasse_reresolution: current.reresolution,
  });
}

const contract = buildWorldSimulationExperientialMethodImpassePrecedentReentryContract();
assert.equal(contract.version, worldSimulationExperientialMethodImpassePrecedentReentryVersion);
assert.equal(contract.phase, "Phase79I");
assert.equal(contract.same_character_prior_committed_turns_only, true);
assert.equal(contract.current_and_historical_method_identity, "exact_normalized_method_skeleton_set");
assert.equal(contract.transfer_ref_cross_turn_equality_required, false);
assert.equal(contract.current_context_matching_mode, "exact_cue_kind_and_content_only");
assert.equal(contract.fuzzy_semantic_similarity_modeled, false);
assert.equal(contract.precedent_automatically_selects_preference, false);
assert.equal(contract.precedent_automatically_selects_action, false);
assert.equal(contract.numeric_success_rate_confidence_probability_utility_reward_modeled, false);
assert.equal(contract.same_turn_feedback_allowed, false);

const projection = build();
assert.equal(projection.precedent_count, 1);
assert.equal(projection.remaining_impasse_refs.length, 1);
const precedent = projection.precedent_cases[0];
assert.equal(precedent.current_impasse_ref, currentImpasseRef);
assert.equal(precedent.historical_impasse_ref, historicalImpasseRef);
assert.notEqual(historicalTransferA, currentTransferA);
assert.equal(precedent.current_corresponding_method_ref, currentTransferA);
assert.equal(
  precedent.historical_dominant_method_skeleton_hash,
  precedent.current_corresponding_method_skeleton_hash,
);
assert.equal(precedent.method_outcome_assessment, "supports_prior_method");
assert.equal(precedent.precedent_kind, "supported_resolution_selected_method_precedent");
assert.equal(precedent.historical_selected_cues.length, 1);
assert.equal(precedent.exact_current_cue_match_count, 1);
assert.equal(precedent.exact_current_cue_matches[0].current_cue_ref, currentCueRef);
assert.equal(precedent.exact_current_cue_matches[0].exact_cue_kind_and_content_match, true);
assert.equal(precedent.all_historical_resolution_cues_exactly_match_current_context, true);
assert.equal(precedent.comparative_preference_validated, false);
assert.equal(precedent.automatic_current_preference_selected, false);
assert.equal(precedent.counterfactual_superiority_inferred, false);
assert.equal(projection.audit.fuzzy_semantic_similarity_used, false);
assert.equal(projection.audit.same_turn_character_brain_feedback, false);
assert.doesNotThrow(() => assertWorldSimulationExperientialMethodImpassePrecedentReentryProjection(
  projection,
  {
    world_simulation_session_id: sessionId,
    character,
    current_turn_id: currentTurnId,
    current_state_revision: currentStateRevision,
    current_world_state_hash: currentWorldStateHash,
  },
));

const changedCue = build({
  current: currentSources({
    cueContent: { visible_route: "right corridor", obstacle: "open" },
  }),
});
assert.equal(changedCue.precedent_count, 1);
assert.equal(changedCue.precedent_cases[0].exact_current_cue_match_count, 0);
assert.equal(changedCue.precedent_cases[0].all_historical_resolution_cues_exactly_match_current_context, false);

const changedMethodSet = build({
  current: currentSources({
    skeletonB: {
      relation: "when_context_then_method",
      method_ref: "method_gamma",
      qualifiers: ["narrow_passage"],
    },
  }),
});
assert.equal(changedMethodSet.precedent_count, 0);

for (const [assessment, expectedKind] of [
  ["counterevidence_for_prior_method", "counterevidenced_resolution_selected_method_precedent"],
  ["ambiguous_no_revision", "ambiguous_resolution_selected_method_precedent"],
]) {
  const candidate = build({ historyTurns: [historicalTurn({ assessment })] });
  assert.equal(candidate.precedent_count, 1);
  assert.equal(candidate.precedent_cases[0].method_outcome_assessment, assessment);
  assert.equal(candidate.precedent_cases[0].precedent_kind, expectedKind);
  assert.equal(candidate.precedent_cases[0].automatic_current_preference_selected, false);
}

const alreadyResolvedCurrent = build({ current: currentSources({ remaining: false }) });
assert.equal(alreadyResolvedCurrent.precedent_count, 0);
assert.deepEqual(alreadyResolvedCurrent.remaining_impasse_refs, []);

const sameTurnHistorical = {
  ...historicalTurn(),
  turn_id: currentTurnId,
};
const sameTurnIgnored = build({ historyTurns: [sameTurnHistorical] });
assert.equal(sameTurnIgnored.precedent_count, 0);
assert.equal(sameTurnIgnored.history_window.total_prior_committed_turn_count, 0);

const tamperedHistoryTurn = JSON.parse(JSON.stringify(historicalTurn()));
tamperedHistoryTurn.experiential_method_impasse_resolution_outcome_evidence.evidence_records[0]
  .method_outcome_assessment = "counterevidence_for_prior_method";
assert.throws(
  () => build({ historyTurns: [tamperedHistoryTurn] }),
  (error) => error?.code
    === "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RESOLUTION_OUTCOME_EVIDENCE_HASH_MISMATCH",
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
const actionProposerIndex = loopSource.indexOf(
  '"world_action_proposer"',
  phase79iIndex,
);
assert.ok(phase79fIndex >= 0 && phase79iIndex > phase79fIndex && actionProposerIndex > phase79iIndex);
assert.match(
  loopSource,
  /const worldHistory = await getWorldSimulationHistory\(sessionId, options\);/,
);
assert.match(
  loopSource,
  /experiential_method_impasse_precedent_reentry_projections:\s*cloneJson\(experientialMethodImpassePrecedentReentryProjections\)/,
);
assert.match(
  loopSource,
  /preparedTurn\.experiential_method_impasse_precedent_reentry_projections \?\? \[\]/,
);
assert.match(
  stateSource,
  /experiential_method_impasse_precedent_reentry_projections:\s*input\.experiential_method_impasse_precedent_reentry_projections \?\? null/,
);
assert.doesNotMatch(
  loopSource,
  /characterCognition\.experiential_method_impasse_precedent/,
);

console.log("Phase79I experiential method impasse precedent re-entry evidence tests passed.");
