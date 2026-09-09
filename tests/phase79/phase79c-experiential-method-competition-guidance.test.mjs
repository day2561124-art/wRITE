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
import {
  buildWorldSimulationExperientialMethodCompetitionGuidanceContract,
  projectWorldSimulationExperientialMethodCompetitionGuidance,
  worldSimulationExperientialMethodCompetitionGuidanceVersion,
} from "../../server/src/world-simulation-experiential-method-competition-guidance-service.mjs";
import { buildWorldSimulationLoopContract } from "../../server/src/world-simulation-loop-service.mjs";

function transferProjection({ character = "千夜", turn = "turn-79c", methods = [] } = {}) {
  const mappings = methods.map((method, index) => ({
    transfer_ref: method.transfer_ref,
    transfer_index: index,
    mapping_kind: "relational_analogy",
    current_cue_refs: method.current_cue_refs,
    method_skeleton_hash: hashAgentRunValue(method.method_skeleton),
    source_knowledge_status: method.source_knowledge_status ?? "supported",
  }));
  const guidance = methods.map((method) => ({
    kind: "analogical_experiential_method",
    method_skeleton: structuredClone(method.method_skeleton),
    source_knowledge_status: method.source_knowledge_status ?? "supported",
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
    current_turn_id: turn,
    character,
    source_phase76d_reentry_hash: "phase76d-source",
    resolver_view_hash: "phase76e-view",
    transferred_method_mappings: mappings,
    character_view: {
      source: "cue_grounded_prior_experiential_relational_methods",
      transferred_methods: guidance,
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

function resolutionFor(transfer, decisions = []) {
  const competition = projectWorldSimulationExperientialMethodCompetition({
    experiential_method_transfer_projections: [transfer],
    current_turn_id: transfer.current_turn_id,
    character: transfer.character,
  });
  const view = buildWorldSimulationExperientialMethodCompetitionResolutionResolverView({
    experiential_method_competition: competition,
    experiential_method_transfer_projections: [transfer],
  });
  return {
    view,
    resolution: projectWorldSimulationExperientialMethodCompetitionResolution({
      resolver_view: view,
      preference_decisions: decisions,
    }),
  };
}

const contract = buildWorldSimulationExperientialMethodCompetitionGuidanceContract();
assert.equal(contract.version, worldSimulationExperientialMethodCompetitionGuidanceVersion);
assert.equal(contract.resolved_dominant_component_keeps_only_dominant_method, true);
assert.equal(contract.tie_impasse_preserves_all_methods_for_deliberation, true);
assert.equal(contract.conflict_impasse_preserves_all_methods_for_deliberation, true);
assert.equal(contract.direct_action_selection_allowed, false);
assert.equal(contract.semantic_revision_allowed, false);

const transfer = transferProjection({ methods: [
  { transfer_ref: "method-a", current_cue_refs: ["shared", "a"], method_skeleton: { relation: "probe_then_commit", method_ref: "semantic-a", qualifiers: [] } },
  { transfer_ref: "method-b", current_cue_refs: ["shared", "b"], method_skeleton: { relation: "commit_then_adjust", method_ref: "semantic-b", qualifiers: [] } },
  { transfer_ref: "method-c", current_cue_refs: ["independent"], method_skeleton: { relation: "observe_only", method_ref: "semantic-c", qualifiers: [] } },
] });
const initial = resolutionFor(transfer);
const pairRef = initial.view.character_contexts[0].competition_pairs[0].competition_ref;
const dominant = resolutionFor(transfer, [{ competition_ref: pairRef, preference: "left_preferred" }]).resolution;
const dominantGuidance = projectWorldSimulationExperientialMethodCompetitionGuidance({
  experiential_method_transfer: transfer,
  experiential_method_competition_resolution: dominant,
});
assert.deepEqual(dominantGuidance.retained_method_refs, ["method-a", "method-c"]);
assert.deepEqual(dominantGuidance.suppressed_competing_method_refs, ["method-b"]);
assert.equal(dominantGuidance.character_view.deliberation_required, false);
assert.deepEqual(
  dominantGuidance.character_view.transferred_methods.map((method) => method.transfer_ref),
  ["method-a", "method-c"],
);
assert.equal(dominantGuidance.audit.action_selection_performed, false);

const tieGuidance = projectWorldSimulationExperientialMethodCompetitionGuidance({
  experiential_method_transfer: transfer,
  experiential_method_competition_resolution: initial.resolution,
});
assert.deepEqual(tieGuidance.retained_method_refs, ["method-a", "method-b", "method-c"]);
assert.equal(tieGuidance.character_view.deliberation_required, true);
assert.equal(tieGuidance.character_view.deliberation_components[0].resolution_status, "tie_impasse");

const indifferent = resolutionFor(transfer, [{ competition_ref: pairRef, preference: "indifferent" }]).resolution;
const indifferentGuidance = projectWorldSimulationExperientialMethodCompetitionGuidance({
  experiential_method_transfer: transfer,
  experiential_method_competition_resolution: indifferent,
});
assert.deepEqual(indifferentGuidance.retained_method_refs, ["method-a", "method-b", "method-c"]);
assert.equal(indifferentGuidance.character_view.deliberation_required, false);

const tamperedResolution = structuredClone(dominant);
tamperedResolution.character_contexts[0].competition_components[0].resolution_status = "invented_status";
assert.throws(
  () => projectWorldSimulationExperientialMethodCompetitionGuidance({
    experiential_method_transfer: transfer,
    experiential_method_competition_resolution: tamperedResolution,
  }),
  (error) => error?.code === "WORLD_SIMULATION_EXPERIENTIAL_METHOD_COMPETITION_GUIDANCE_RESOLUTION_HASH_MISMATCH",
);
const rehashedInvalid = structuredClone(tamperedResolution);
delete rehashedInvalid.resolution_hash;
rehashedInvalid.resolution_hash = hashAgentRunValue(rehashedInvalid);
assert.throws(
  () => projectWorldSimulationExperientialMethodCompetitionGuidance({
    experiential_method_transfer: transfer,
    experiential_method_competition_resolution: rehashedInvalid,
  }),
  (error) => error?.code === "WORLD_SIMULATION_EXPERIENTIAL_METHOD_COMPETITION_GUIDANCE_RESOLUTION_COMPONENT_INVALID",
);

const loopContract = buildWorldSimulationLoopContract();
assert.equal(loopContract.experiential_method_competition_guidance.version, worldSimulationExperientialMethodCompetitionGuidanceVersion);
assert.equal(loopContract.experiential_method_competition_resolver_hook.option_name, "experientialMethodCompetitionResolver");
assert.equal(loopContract.experiential_method_competition_resolver_hook.action_selection_authority, false);
assert.equal(loopContract.experiential_method_competition_resolver_hook.missing_hook_preserves_competition_as_impasse, true);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const loopSource = fs.readFileSync(path.resolve(__dirname, "../../server/src/world-simulation-loop-service.mjs"), "utf8");
const stateSource = fs.readFileSync(path.resolve(__dirname, "../../server/src/world-simulation-state-service.mjs"), "utf8");
const transferIndex = loopSource.indexOf("const experientialMethodTransfer =");
const competitionIndex = loopSource.indexOf("const experientialMethodCompetition =", transferIndex);
const resolutionIndex = loopSource.indexOf("const experientialMethodCompetitionResolution =", competitionIndex);
const guidanceIndex = loopSource.indexOf("const experientialMethodCompetitionGuidance =", resolutionIndex);
const cognitionIndex = loopSource.indexOf("characterCognition.experiential_method_guidance =", guidanceIndex);
const actionProposerIndex = loopSource.indexOf('"world_action_proposer"', cognitionIndex);
assert.ok(
  transferIndex >= 0 && competitionIndex > transferIndex && resolutionIndex > competitionIndex
    && guidanceIndex > resolutionIndex && cognitionIndex > guidanceIndex && actionProposerIndex > cognitionIndex,
  "Phase79C guidance must resolve Phase76E competition before Action Proposer sees experiential method guidance.",
);
assert.match(loopSource, /experiential_method_competition_projections:/);
assert.match(loopSource, /experiential_method_competition_resolution_projections:/);
assert.match(loopSource, /experiential_method_competition_guidance_projections:/);
assert.match(stateSource, /experiential_method_competition_projections:/);
assert.match(stateSource, /experiential_method_competition_resolution_projections:/);
assert.match(stateSource, /experiential_method_competition_guidance_projections:/);

console.log("Phase79C experiential method competition guidance tests passed.");
