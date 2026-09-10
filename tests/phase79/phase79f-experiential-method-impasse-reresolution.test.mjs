import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import { worldSimulationExperientialMethodTransferVersion } from "../../server/src/world-simulation-experiential-method-transfer-service.mjs";
import { projectWorldSimulationExperientialMethodCompetition } from "../../server/src/world-simulation-experiential-method-competition-service.mjs";
import {
  buildWorldSimulationExperientialMethodCompetitionResolutionResolverView,
  projectWorldSimulationExperientialMethodCompetitionResolution,
} from "../../server/src/world-simulation-experiential-method-competition-resolution-service.mjs";
import { projectWorldSimulationExperientialMethodCompetitionGuidance } from "../../server/src/world-simulation-experiential-method-competition-guidance-service.mjs";
import { projectWorldSimulationExperientialMethodImpasseDeliberation } from "../../server/src/world-simulation-experiential-method-impasse-deliberation-service.mjs";
import { projectWorldSimulationExperientialMethodImpasseDiscriminatingEvidence } from "../../server/src/world-simulation-experiential-method-impasse-discriminating-evidence-service.mjs";
import {
  buildWorldSimulationExperientialMethodImpasseReresolutionContract,
  buildWorldSimulationExperientialMethodImpasseReresolutionResolverView,
  projectWorldSimulationExperientialMethodImpasseReresolution,
  worldSimulationExperientialMethodImpasseReresolutionVersion,
} from "../../server/src/world-simulation-experiential-method-impasse-reresolution-service.mjs";
import { buildWorldSimulationLoopContract } from "../../server/src/world-simulation-loop-service.mjs";

function transferProjection(methodRefs = ["method-a", "method-b"], turnId = "turn-79f") {
  const methods = methodRefs.map((ref, index) => ({
    transfer_ref: ref,
    current_cue_refs: ["shared", `cue-${index}`],
    method_skeleton: {
      relation: `method_relation_${index}`,
      method_ref: `semantic-${index}`,
      qualifiers: [],
    },
  }));
  const mappings = methods.map((method, index) => ({
    transfer_ref: method.transfer_ref,
    transfer_index: index,
    mapping_kind: "relational_analogy",
    current_cue_refs: method.current_cue_refs,
    method_skeleton_hash: hashAgentRunValue(method.method_skeleton),
    source_knowledge_status: "supported",
  }));
  const transferredMethods = methods.map((method) => ({
    kind: "analogical_experiential_method",
    method_skeleton: structuredClone(method.method_skeleton),
    source_knowledge_status: "supported",
    mapping_kind: "relational_analogy",
    current_context_grounded: true,
    current_context_basis: ["perception"],
    relational_structure_transfer: true,
    surface_case_replay: false,
    exact_action_replay: false,
    advisory_only: true,
    candidate_action_generation_deferred: true,
    current_available_action_mapping_required: true,
    current_context_revalidation_required: true,
    adaptation_before_use_required: true,
    contested_source_requires_extra_revalidation: false,
    subjective_not_world_truth: true,
    selected_action_authority: false,
    objective_feasibility_verified: false,
  }));
  const projection = {
    version: worldSimulationExperientialMethodTransferVersion,
    current_turn_id: turnId,
    character: "千夜",
    source_phase76d_reentry_hash: "phase76d-source",
    resolver_view_hash: "phase76e-view",
    transferred_method_mappings: mappings,
    character_view: {
      source: "cue_grounded_prior_experiential_relational_methods",
      transferred_methods: transferredMethods,
      advisory_only: true,
      selected_action_authority: false,
      action_candidate_generation_owner: "existing_world_action_proposer",
      current_context_revalidation_required: true,
      adaptation_before_use_required: true,
    },
    audit: {
      canonical_phase76d_source_verified: true,
      recurring_event_pattern_only: true,
      relational_structure_transfer_only: true,
      source_surface_case_replayed: false,
      exact_action_replay_allowed: false,
      resolver_authored_method_content: false,
      resolver_authored_action_content: false,
      current_context_grounding_required: true,
      transferred_method_count: mappings.length,
      supported_and_contested_status_preserved: true,
      numeric_similarity_confidence_probability_utility_modeled: false,
      objective_feasibility_verified: false,
      world_truth_authority_claimed: false,
      direct_action_selection: false,
      direct_plan_goal_mutation: false,
      direct_belief_write: false,
      direct_current_mind_write: false,
      direct_world_state_mutation: false,
      existing_action_proposer_reused: true,
      existing_phase74_deliberation_grounding_targeted: true,
      existing_phase71_plan_lifecycle_preserved: true,
      parallel_memory_belief_plan_store_created: false,
    },
  };
  projection.transfer_hash = hashAgentRunValue(projection);
  return projection;
}

function canonicalChain({ methodRefs = ["method-a", "method-b"], preferenceDecisions = [], turnId = "turn-79f" } = {}) {
  const transfer = transferProjection(methodRefs, turnId);
  const competition = projectWorldSimulationExperientialMethodCompetition({
    experiential_method_transfer_projections: [transfer],
    current_turn_id: transfer.current_turn_id,
    character: transfer.character,
  });
  const phase79bView = buildWorldSimulationExperientialMethodCompetitionResolutionResolverView({
    experiential_method_competition: competition,
    experiential_method_transfer_projections: [transfer],
  });
  const phase79bResolution = projectWorldSimulationExperientialMethodCompetitionResolution({
    resolver_view: phase79bView,
    preference_decisions: preferenceDecisions,
  });
  const phase79cGuidance = projectWorldSimulationExperientialMethodCompetitionGuidance({
    experiential_method_transfer: transfer,
    experiential_method_competition_resolution: phase79bResolution,
  });
  const phase79dImpasse = projectWorldSimulationExperientialMethodImpasseDeliberation({
    experiential_method_competition_resolution: phase79bResolution,
    experiential_method_competition_guidance: phase79cGuidance,
  });
  const phase79eEvidence = projectWorldSimulationExperientialMethodImpasseDiscriminatingEvidence({
    experiential_method_impasse_deliberation: phase79dImpasse,
    current_context: {
      perception: { route_state: "left route blocked, right route open" },
      attention: { focus: "available escape route" },
      working_context: [{ content: "probe before committing" }],
      subjective_cognition: { beliefs: [{ proposition: "avoid blocked routes" }] },
    },
  });
  const phase79fView = buildWorldSimulationExperientialMethodImpasseReresolutionResolverView({
    source_phase79b_resolver_view: phase79bView,
    source_phase79b_resolution: phase79bResolution,
    source_phase79d_impasse_deliberation: phase79dImpasse,
    source_phase79e_discriminating_evidence: phase79eEvidence,
  });
  return {
    transfer,
    competition,
    phase79bView,
    phase79bResolution,
    phase79cGuidance,
    phase79dImpasse,
    phase79eEvidence,
    phase79fView,
  };
}

function preferenceForWinner(pair, winnerRef) {
  assert.ok(pair.left_transfer_ref === winnerRef || pair.right_transfer_ref === winnerRef);
  return pair.left_transfer_ref === winnerRef ? "left_preferred" : "right_preferred";
}

const contract = buildWorldSimulationExperientialMethodImpasseReresolutionContract();
assert.equal(contract.version, worldSimulationExperientialMethodImpasseReresolutionVersion);
assert.equal(contract.existing_phase79b_resolution_kernel_reused, true);
assert.equal(contract.preference_revision_requires_phase79e_evidence_refs, true);
assert.equal(contract.arbitrary_tie_breaking_allowed, false);
assert.equal(contract.direct_action_selection_allowed, false);
assert.equal(contract.semantic_revision_allowed, false);

// Tie: no Phase79B preference initially; one evidence-backed Phase79F result
// should resolve through the existing Phase79B kernel and Phase79C compiler.
const tie = canonicalChain();
assert.equal(tie.phase79bResolution.tie_impasse_count, 1);
assert.equal(tie.phase79dImpasse.impasse_count, 1);
const tieContext = tie.phase79fView.impasse_contexts[0];
const tiePair = tieContext.competition_pairs[0];
const tieCueRef = tieContext.current_context_cue_catalog[0].cue_ref;
const tieResolved = projectWorldSimulationExperientialMethodImpasseReresolution({
  resolver_view: tie.phase79fView,
  source_phase79b_resolver_view: tie.phase79bView,
  source_phase79b_resolution: tie.phase79bResolution,
  source_phase79d_impasse_deliberation: tie.phase79dImpasse,
  source_phase79e_discriminating_evidence: tie.phase79eEvidence,
  preference_revisions: [{
    impasse_ref: tieContext.impasse_ref,
    competition_ref: tiePair.competition_ref,
    preference: "left_preferred",
    evidence_cue_refs: [tieCueRef],
  }],
});
assert.equal(tieResolved.resolved_impasse_count, 1);
assert.equal(tieResolved.remaining_impasse_count, 0);
assert.equal(tieResolved.effective_competition_resolution.tie_impasse_count, 0);
assert.equal(tieResolved.effective_competition_resolution.conflict_impasse_count, 0);
assert.equal(tieResolved.effective_competition_resolution.resolved_dominant_component_count, 1);
assert.equal(tieResolved.impasse_results[0].resolution_status, "resolved_dominant");
assert.equal(tieResolved.impasse_results[0].dominant_method_ref, tiePair.left_transfer_ref);
assert.deepEqual(tieResolved.impasse_results[0].applied_preference_revisions[0].evidence_cue_refs, [tieCueRef]);
const tieEffectiveGuidance = projectWorldSimulationExperientialMethodCompetitionGuidance({
  experiential_method_transfer: tie.transfer,
  experiential_method_competition_resolution: tieResolved.effective_competition_resolution,
});
assert.equal(tieEffectiveGuidance.character_view.deliberation_required, false);
assert.deepEqual(tieEffectiveGuidance.retained_method_refs, [tiePair.left_transfer_ref]);
assert.equal(tieResolved.audit.existing_phase79b_resolution_kernel_reused, true);
assert.equal(tieResolved.audit.action_selection_performed, false);
assert.equal(tieResolved.audit.semantic_revision_performed, false);
assert.equal(tieResolved.audit.numeric_similarity_confidence_probability_utility_modeled, false);

// No new substate result means no arbitrary tie-break: reproduce the original
// Phase79B resolution exactly and preserve the impasse.
const tieUnchanged = projectWorldSimulationExperientialMethodImpasseReresolution({
  resolver_view: tie.phase79fView,
  source_phase79b_resolver_view: tie.phase79bView,
  source_phase79b_resolution: tie.phase79bResolution,
  source_phase79d_impasse_deliberation: tie.phase79dImpasse,
  source_phase79e_discriminating_evidence: tie.phase79eEvidence,
  preference_revisions: [],
});
assert.equal(tieUnchanged.effective_phase79b_resolution_hash, tie.phase79bResolution.resolution_hash);
assert.equal(tieUnchanged.resolved_impasse_count, 0);
assert.equal(tieUnchanged.remaining_impasse_count, 1);
assert.equal(tieUnchanged.impasse_results[0].resolution_status, "tie_impasse");

// Conflict: create a three-method A>B, B>C, C>A cycle, then revise only the
// A/C pair using a canonical Phase79E cue. The same Phase79B kernel should now
// derive A as the transitive dominant method.
const conflictTransfer = transferProjection(["method-a", "method-b", "method-c"], "turn-79f-conflict");
const conflictCompetition = projectWorldSimulationExperientialMethodCompetition({
  experiential_method_transfer_projections: [conflictTransfer],
  current_turn_id: conflictTransfer.current_turn_id,
  character: conflictTransfer.character,
});
const conflictView = buildWorldSimulationExperientialMethodCompetitionResolutionResolverView({
  experiential_method_competition: conflictCompetition,
  experiential_method_transfer_projections: [conflictTransfer],
});
const conflictPairs = conflictView.character_contexts[0].competition_pairs;
assert.equal(conflictPairs.length, 3);
function pairBetween(left, right) {
  const pair = conflictPairs.find((entry) =>
    new Set([entry.left_transfer_ref, entry.right_transfer_ref]).has(left)
      && new Set([entry.left_transfer_ref, entry.right_transfer_ref]).has(right));
  assert.ok(pair, `missing competition pair ${left}/${right}`);
  return pair;
}
const pairAB = pairBetween("method-a", "method-b");
const pairBC = pairBetween("method-b", "method-c");
const pairAC = pairBetween("method-a", "method-c");
const conflictResolution = projectWorldSimulationExperientialMethodCompetitionResolution({
  resolver_view: conflictView,
  preference_decisions: [
    { competition_ref: pairAB.competition_ref, preference: preferenceForWinner(pairAB, "method-a") },
    { competition_ref: pairBC.competition_ref, preference: preferenceForWinner(pairBC, "method-b") },
    { competition_ref: pairAC.competition_ref, preference: preferenceForWinner(pairAC, "method-c") },
  ],
});
assert.equal(conflictResolution.conflict_impasse_count, 1);
const conflictGuidance = projectWorldSimulationExperientialMethodCompetitionGuidance({
  experiential_method_transfer: conflictTransfer,
  experiential_method_competition_resolution: conflictResolution,
});
const conflictImpasse = projectWorldSimulationExperientialMethodImpasseDeliberation({
  experiential_method_competition_resolution: conflictResolution,
  experiential_method_competition_guidance: conflictGuidance,
});
assert.equal(conflictImpasse.impasse_contexts[0].impasse_type, "conflict_impasse");
const conflictEvidence = projectWorldSimulationExperientialMethodImpasseDiscriminatingEvidence({
  experiential_method_impasse_deliberation: conflictImpasse,
  current_context: { perception: { discriminating_observation: "method-a matches the open route" } },
});
const conflictReresolutionView = buildWorldSimulationExperientialMethodImpasseReresolutionResolverView({
  source_phase79b_resolver_view: conflictView,
  source_phase79b_resolution: conflictResolution,
  source_phase79d_impasse_deliberation: conflictImpasse,
  source_phase79e_discriminating_evidence: conflictEvidence,
});
const conflictCueRef = conflictReresolutionView.impasse_contexts[0].current_context_cue_catalog[0].cue_ref;
const conflictResolved = projectWorldSimulationExperientialMethodImpasseReresolution({
  resolver_view: conflictReresolutionView,
  source_phase79b_resolver_view: conflictView,
  source_phase79b_resolution: conflictResolution,
  source_phase79d_impasse_deliberation: conflictImpasse,
  source_phase79e_discriminating_evidence: conflictEvidence,
  preference_revisions: [{
    impasse_ref: conflictReresolutionView.impasse_contexts[0].impasse_ref,
    competition_ref: pairAC.competition_ref,
    preference: preferenceForWinner(pairAC, "method-a"),
    evidence_cue_refs: [conflictCueRef],
  }],
});
assert.equal(conflictResolved.remaining_impasse_count, 0);
assert.equal(conflictResolved.effective_competition_resolution.conflict_impasse_count, 0);
assert.equal(conflictResolved.impasse_results[0].dominant_method_ref, "method-a");

// Resolver is strictly bounded to canonical Phase79E evidence and cannot
// author free-form rationales, scores, actions, or out-of-view references.
const commonTieInput = {
  resolver_view: tie.phase79fView,
  source_phase79b_resolver_view: tie.phase79bView,
  source_phase79b_resolution: tie.phase79bResolution,
  source_phase79d_impasse_deliberation: tie.phase79dImpasse,
  source_phase79e_discriminating_evidence: tie.phase79eEvidence,
};
assert.throws(
  () => projectWorldSimulationExperientialMethodImpasseReresolution({
    ...commonTieInput,
    preference_revisions: [{
      impasse_ref: tieContext.impasse_ref,
      competition_ref: tiePair.competition_ref,
      preference: "left_preferred",
      evidence_cue_refs: [],
    }],
  }),
  (error) => error?.code === "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RERESOLUTION_EVIDENCE_INVALID",
);
assert.throws(
  () => projectWorldSimulationExperientialMethodImpasseReresolution({
    ...commonTieInput,
    preference_revisions: [{
      impasse_ref: tieContext.impasse_ref,
      competition_ref: tiePair.competition_ref,
      preference: "left_preferred",
      evidence_cue_refs: ["invented-cue"],
    }],
  }),
  (error) => error?.code === "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RERESOLUTION_EVIDENCE_OUT_OF_VIEW",
);
assert.throws(
  () => projectWorldSimulationExperientialMethodImpasseReresolution({
    ...commonTieInput,
    preference_revisions: [{
      impasse_ref: tieContext.impasse_ref,
      competition_ref: "invented-competition",
      preference: "left_preferred",
      evidence_cue_refs: [tieCueRef],
    }],
  }),
  (error) => error?.code === "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RERESOLUTION_DECISION_OUT_OF_VIEW",
);
for (const forbiddenField of ["utility", "confidence", "action", "reason"]) {
  assert.throws(
    () => projectWorldSimulationExperientialMethodImpasseReresolution({
      ...commonTieInput,
      preference_revisions: [{
        impasse_ref: tieContext.impasse_ref,
        competition_ref: tiePair.competition_ref,
        preference: "left_preferred",
        evidence_cue_refs: [tieCueRef],
        [forbiddenField]: forbiddenField === "utility" ? 1 : "forbidden",
      }],
    }),
    (error) => error?.code === "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RERESOLUTION_AUTHORITY_FIELD_FORBIDDEN",
  );
}
const tamperedEvidence = structuredClone(tie.phase79eEvidence);
tamperedEvidence.impasse_evidence_contexts[0].current_context_cue_catalog[0].content = { invented: true };
assert.throws(
  () => buildWorldSimulationExperientialMethodImpasseReresolutionResolverView({
    source_phase79b_resolver_view: tie.phase79bView,
    source_phase79b_resolution: tie.phase79bResolution,
    source_phase79d_impasse_deliberation: tie.phase79dImpasse,
    source_phase79e_discriminating_evidence: tamperedEvidence,
  }),
  (error) => error?.code === "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RERESOLUTION_PHASE79E_HASH_MISMATCH",
);

const resolverPayloadSerialized = JSON.stringify(tie.phase79fView.impasse_contexts);
assert.doesNotMatch(resolverPayloadSerialized, /selection_contract|world_state|raw_action_outcome|hidden_causal_evidence/);
assert.equal(tie.phase79fView.boundaries.original_phase79b_engine_resolver_view_exposed, false);

const loopContract = buildWorldSimulationLoopContract();
assert.equal(
  loopContract.experiential_method_impasse_reresolution.version,
  worldSimulationExperientialMethodImpasseReresolutionVersion,
);
assert.equal(
  loopContract.experiential_method_impasse_reresolution_resolver_hook.option_name,
  "experientialMethodImpasseReresolutionResolver",
);
assert.equal(
  loopContract.experiential_method_impasse_reresolution_resolver_hook.receives_original_phase79b_engine_resolver_view,
  false,
);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const loopSource = fs.readFileSync(path.resolve(__dirname, "../../server/src/world-simulation-loop-service.mjs"), "utf8");
const stateSource = fs.readFileSync(path.resolve(__dirname, "../../server/src/world-simulation-state-service.mjs"), "utf8");
const phase79dIndex = loopSource.indexOf("const experientialMethodImpasseDeliberation =");
const phase79eIndex = loopSource.indexOf("const experientialMethodImpasseDiscriminatingEvidence =", phase79dIndex);
const phase79fViewIndex = loopSource.indexOf("const experientialMethodImpasseReresolutionResolverView =", phase79eIndex);
const phase79fIndex = loopSource.indexOf("const experientialMethodImpasseReresolution =", phase79fViewIndex);
const effectiveGuidanceIndex = loopSource.indexOf("const effectiveExperientialMethodCompetitionGuidance =", phase79fIndex);
const actionProposerIndex = loopSource.indexOf('"world_action_proposer"', effectiveGuidanceIndex);
assert.ok(
  phase79dIndex >= 0
    && phase79eIndex > phase79dIndex
    && phase79fViewIndex > phase79eIndex
    && phase79fIndex > phase79fViewIndex
    && effectiveGuidanceIndex > phase79fIndex
    && actionProposerIndex > effectiveGuidanceIndex,
);
assert.match(loopSource, /experiential_method_impasse_reresolution_projections:/);
assert.match(stateSource, /experiential_method_impasse_reresolution_projections:/);
assert.match(loopSource, /projectWorldSimulationExperientialMethodCompetitionResolution\(\{/);
assert.match(loopSource, /effectiveExperientialMethodCompetitionGuidance\.character_view/);

console.log("Phase79F experiential method impasse re-resolution tests passed.");
