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
import {
  buildWorldSimulationExperientialMethodImpasseDeliberationContract,
  projectWorldSimulationExperientialMethodImpasseDeliberation,
  worldSimulationExperientialMethodImpasseDeliberationVersion,
} from "../../server/src/world-simulation-experiential-method-impasse-deliberation-service.mjs";
import { buildWorldSimulationLoopContract } from "../../server/src/world-simulation-loop-service.mjs";

function transferProjection() {
  const methods = [
    { transfer_ref: "method-a", current_cue_refs: ["shared", "a"], method_skeleton: { relation: "probe_then_commit", method_ref: "semantic-a", qualifiers: [] } },
    { transfer_ref: "method-b", current_cue_refs: ["shared", "b"], method_skeleton: { relation: "commit_then_adjust", method_ref: "semantic-b", qualifiers: [] } },
  ];
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
    current_turn_id: "turn-79d",
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

const contract = buildWorldSimulationExperientialMethodImpasseDeliberationContract();
assert.equal(contract.version, worldSimulationExperientialMethodImpasseDeliberationVersion);
assert.equal(contract.tie_and_conflict_impasses_only, true);
assert.equal(contract.new_preference_authored, false);
assert.equal(contract.arbitrary_tie_breaking_allowed, false);
assert.equal(contract.direct_action_selection_allowed, false);

const transfer = transferProjection();
const competition = projectWorldSimulationExperientialMethodCompetition({
  experiential_method_transfer_projections: [transfer],
  current_turn_id: transfer.current_turn_id,
  character: transfer.character,
});
const view = buildWorldSimulationExperientialMethodCompetitionResolutionResolverView({
  experiential_method_competition: competition,
  experiential_method_transfer_projections: [transfer],
});
const tieResolution = projectWorldSimulationExperientialMethodCompetitionResolution({
  resolver_view: view,
  preference_decisions: [],
});
const tieGuidance = projectWorldSimulationExperientialMethodCompetitionGuidance({
  experiential_method_transfer: transfer,
  experiential_method_competition_resolution: tieResolution,
});
const tieImpasse = projectWorldSimulationExperientialMethodImpasseDeliberation({
  experiential_method_competition_resolution: tieResolution,
  experiential_method_competition_guidance: tieGuidance,
});
assert.equal(tieImpasse.deliberation_required, true);
assert.equal(tieImpasse.impasse_count, 1);
assert.equal(tieImpasse.impasse_contexts[0].impasse_type, "tie_impasse");
assert.deepEqual(tieImpasse.impasse_contexts[0].retained_method_refs, ["method-a", "method-b"]);
assert.deepEqual(tieImpasse.impasse_contexts[0].candidate_methods.map((item) => item.current_context_basis), [["perception"], ["perception"]]);
assert.equal(tieImpasse.impasse_contexts[0].deliberation_contract.new_preference_may_be_authored_here, false);
assert.equal(tieImpasse.audit.numeric_similarity_confidence_probability_utility_modeled, false);

const pairRef = view.character_contexts[0].competition_pairs[0].competition_ref;
const resolved = projectWorldSimulationExperientialMethodCompetitionResolution({
  resolver_view: view,
  preference_decisions: [{ competition_ref: pairRef, preference: "left_preferred" }],
});
const resolvedGuidance = projectWorldSimulationExperientialMethodCompetitionGuidance({
  experiential_method_transfer: transfer,
  experiential_method_competition_resolution: resolved,
});
const noImpasse = projectWorldSimulationExperientialMethodImpasseDeliberation({
  experiential_method_competition_resolution: resolved,
  experiential_method_competition_guidance: resolvedGuidance,
});
assert.equal(noImpasse.deliberation_required, false);
assert.equal(noImpasse.impasse_count, 0);

const tampered = structuredClone(tieGuidance);
tampered.character_view.deliberation_components[0].resolution_status = "conflict_impasse";
assert.throws(
  () => projectWorldSimulationExperientialMethodImpasseDeliberation({
    experiential_method_competition_resolution: tieResolution,
    experiential_method_competition_guidance: tampered,
  }),
  (error) => error?.code === "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_GUIDANCE_HASH_MISMATCH",
);

const loopContract = buildWorldSimulationLoopContract();
assert.equal(loopContract.experiential_method_impasse_deliberation.version, worldSimulationExperientialMethodImpasseDeliberationVersion);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const loopSource = fs.readFileSync(path.resolve(__dirname, "../../server/src/world-simulation-loop-service.mjs"), "utf8");
const stateSource = fs.readFileSync(path.resolve(__dirname, "../../server/src/world-simulation-state-service.mjs"), "utf8");
const guidanceIndex = loopSource.indexOf("const experientialMethodCompetitionGuidance =");
const impasseIndex = loopSource.indexOf("const experientialMethodImpasseDeliberation =", guidanceIndex);
const cognitionIndex = loopSource.indexOf("characterCognition.experiential_method_impasse_deliberation =", impasseIndex);
const actionProposerIndex = loopSource.indexOf('"world_action_proposer"', cognitionIndex);
assert.ok(guidanceIndex >= 0 && impasseIndex > guidanceIndex && cognitionIndex > impasseIndex && actionProposerIndex > cognitionIndex);
assert.match(loopSource, /experiential_method_impasse_deliberation_projections:/);
assert.match(stateSource, /experiential_method_impasse_deliberation_projections:/);

console.log("Phase79D experiential method impasse deliberation tests passed.");
